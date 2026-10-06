import assert from 'node:assert/strict';
import { decodeFunctionData, encodeAbiParameters, keccak256, parseAbi } from 'viem';
import { readGenesisAuction, prepareGenesisAuctionTransaction } from '../src/genesisauction.js';

const address = n => `0x${n.toString(16).padStart(40, '0')}`;
const account = address(99), other = address(100), validator = address(5);
const zero = address(0), blockHash = `0x${'ab'.repeat(32)}`;
const names = ['auction', 'coordinator', 'characterNft', 'omr', 'validator'];
const contracts = Object.fromEntries(names.map((name, i) => [name, {
  address: address(i + 1), runtimeCodeHash: keccak256(`0x60${(i + 1).toString(16).padStart(2, '0')}`),
}]));
const dependencies = Object.fromEntries(['poolManager', 'positionManager', 'permit2', 'hook'].map((name, i) =>
  [name, { address: address(11 + i), runtimeCodeHash: keccak256(`0x60${(11 + i).toString(16)}`) }]));
const manifest = { chainId: 4663, contracts, dependencies };
const codes = Object.fromEntries(names.map((name, i) => [contracts[name].address, `0x60${(i + 1).toString(16).padStart(2, '0')}`]));
codes[validator] = '0x6005';
for (const pin of Object.values(dependencies)) codes[pin.address] = `0x60${Number(BigInt(pin.address)).toString(16)}`;
function fixture() {
  const values = {
    auction: { characterNft: contracts.characterNft.address, token: contracts.omr.address, currency: zero,
      launchGate: contracts.coordinator.address, fundsRecipient: contracts.coordinator.address,
      launchGateCodeHash: contracts.coordinator.runtimeCodeHash, launchChainId: 4663n,
      validationHook: validator, blockNumberish: 115n, startBlock: 110n, endBlock: 120n, claimBlock: 130n,
      floorPrice: 100n, MAX_BID_PRICE: 100000n, TICK_SPACING_Q96: 2n, isGraduated: true, nextBidId: 2n,
      bids: [110n, 1n, 0n, 1000n, account, 1n << 96n, 0n] },
    coordinator: { auction: contracts.auction.address, characterNft: contracts.characterNft.address, characterNftCodeHash: contracts.characterNft.runtimeCodeHash, validatorCodeHash: contracts.validator.runtimeCodeHash,
      omr: contracts.omr.address, auctionCodeHash: contracts.auction.runtimeCodeHash,
      poolManager: dependencies.poolManager.address, positionManager: dependencies.positionManager.address,
      permit2: dependencies.permit2.address, hookCodeHash: dependencies.hook.runtimeCodeHash,
      poolKey: [zero, contracts.omr.address, 3000, 60, dependencies.hook.address], chainId: 4663n,
      migrationSucceeded: false, playerClaimsOpen: false, auctionPriceX96: 0n },
    characterNft: { balanceOf: 1n },
    validator: { characterNft: contracts.characterNft.address, characterNftCodeHash: contracts.characterNft.runtimeCodeHash,
      eligibilityChainId: 4663n },
  };
  let chain = 4663, changedHash = false, badCode = false, simulationFails = false, timestamp = 1000n;
  let simpleExitFails = false, badValidator = false;
  const checkpoints = new Map();
  const observations = [], simulations = [];
  const client = {
    getChainId: async () => chain,
    getBlock: async args => ({ number: 115n, timestamp, hash: args?.blockNumber && changedHash ? `0x${'cd'.repeat(32)}` : blockHash }),
    getCode: async args => { observations.push(args); return badCode || (badValidator && args.address.toLowerCase() === validator)
      ? '0x6000' : codes[args.address.toLowerCase()]; },
    readContract: async args => {
      observations.push(args);
      if (args.address === dependencies.positionManager.address && args.functionName === 'poolManager')
        return dependencies.poolManager.address;
      const name = args.address.toLowerCase() === validator ? 'validator'
        : names.find(n => contracts[n].address === args.address.toLowerCase());
      assert.ok(name, 'all contract reads target manifest contracts or pinned auction validator');
      if (args.functionName === 'checkpoints') return checkpoints.get(args.args[0].toString()) || [0n, 0n, 0n, 0n, 0n, 0n];
      assert.ok(Object.hasOwn(values[name], args.functionName), `fixture knows ${name}.${args.functionName}`);
      return values[name][args.functionName];
    },
    simulateContract: async args => { simulations.push(args);
      if (simulationFails || (simpleExitFails && args.functionName === 'exitBid')) throw new Error('sensitive RPC details'); },
  };
  return { values, client, observations, simulations, options: { manifest, account, client, nowMs: 1000000 },
    chain: n => { chain = n; }, reorg: () => { changedHash = true; }, badCode: () => { badCode = true; },
    failSimulation: () => { simulationFails = true; }, timestamp: n => { timestamp = n; },
    simpleExitFails: () => { simpleExitFails = true; }, badValidator: () => { badValidator = true; }, checkpoints };
}

const txAbi = parseAbi(['function submitBid(uint256,uint128,address,bytes) payable returns (uint256)', 'function exitBid(uint256)', 'function claimTokens(uint256)', 'function exitPartiallyFilledBid(uint256,uint64,uint64)']);
const rejected = (options, code) => assert.rejects(() => prepareGenesisAuctionTransaction(options), { code });
let f = fixture();
const state = await readGenesisAuction({...f.options,bidId:'1'});
assert.equal(state.phase,'auction'); assert.equal(state.nftOwned,true); assert.equal(state.bid.ownedByAccount,true);
assert.ok(!Object.hasOwn(state,'player')); assert.ok(!Object.hasOwn(state,'playerEligibility'));
const bid = await prepareGenesisAuctionTransaction({...f.options,action:'bid',amountEth:'0.123456789012345678',maxPriceX96:'1000',to:other,data:'0xdeadbeef'});
assert.deepEqual(decodeFunctionData({abi:txAbi,data:bid.data}).args,[1000n,123456789012345678n,account,'0x']);
assert.equal(bid.to.toLowerCase(),contracts.auction.address);assert.equal(bid.valueWei,'123456789012345678');
assert.ok(f.observations.every(o=>o.blockNumber===115n));assert.equal(f.simulations.at(-1).blockNumber,115n);
assert.doesNotThrow(()=>JSON.stringify(state));assert.doesNotThrow(()=>JSON.stringify(bid));
assert.equal(state.auction.tickSpacingQ96, '2');
await rejected({...f.options, action:'bid', amountEth:'1', maxPriceX96:'1001'}, 'invalid_input');
assert.equal(f.simulations.length, 1, 'off-tick bids are rejected before simulation');
assert.ok(f.observations.some(o => o.functionName === 'TICK_SPACING_Q96' && o.blockNumber === 115n));
for(const action of ['contribute','claimPlayer','refundPlayer','transfer']) await rejected({...f.options,action},'invalid_input');
for(const amountEth of ['0','-1','1e-3','0.0000000000000000001','01',0.1,'9'.repeat(120)]) await rejected({...f.options,action:'bid',amountEth,maxPriceX96:'1000'},'invalid_input');
f=fixture();f.values.characterNft.balanceOf=0n; await rejected({...f.options,action:'bid',amountEth:'1',maxPriceX96:'1000'},'nft_required');
f.values.auction.blockNumberish=120n;
for(const action of ['exitBid','claimBid']) { const tx=await prepareGenesisAuctionTransaction({...f.options,action,bidId:'1'});assert.equal(tx.value,'0x0'); }
assert.equal(f.observations.filter(o=>o.functionName==='balanceOf').length,1,'only rejected bid reads NFTbalance');
f.values.auction.bids[4]=other;await rejected({...f.options,action:'claimBid',bidId:'1'},'bid_owner');
f=fixture();f.reorg();await rejected({...f.options,action:'claimBid',bidId:'1'},'state_unavailable');
f=fixture();f.chain(1);await rejected({...f.options,action:'bid',amountEth:'1',maxPriceX96:'1000'},'deployment_mismatch');
f=fixture();f.badCode();await assert.rejects(()=>readGenesisAuction(f.options),{code:'deployment_mismatch'});
f=fixture();f.badValidator();await assert.rejects(()=>readGenesisAuction(f.options),{code:'deployment_mismatch'});
f=fixture();f.failSimulation();await rejected({...f.options,action:'claimBid',bidId:'1'},'simulation_failed');
for(const timestamp of [879n,1031n]){ f=fixture();f.timestamp(timestamp);await assert.rejects(()=>readGenesisAuction(f.options),{code:'state_unavailable'}); }
const sentinel = (1n << 64n) - 1n;
const checkpoint = (price, prev, next) => [price, 0n, 0n, 1n, prev, next];
function partialFixture() {
  const p = fixture(); p.simpleExitFails(); p.values.characterNft.balanceOf = 0n;
  p.values.auction.blockNumberish = 120n;
  p.checkpoints.set('110', checkpoint(100n, 0n, 115n));
  p.checkpoints.set('115', checkpoint(1000n, 110n, 120n));
  p.checkpoints.set('120', checkpoint(1200n, 115n, sentinel));
  return p;
}
f = partialFixture();
let exit = await prepareGenesisAuctionTransaction({ ...f.options, action: 'exitBid', bidId: '1' });
let exitCall = decodeFunctionData({ abi: txAbi, data: exit.data });
assert.equal(exitCall.functionName, 'exitPartiallyFilledBid');
assert.deepEqual(exitCall.args, [1n, 110n, 120n]); assert.equal(exit.value, '0x0');
assert.equal(f.simulations.length, 2); assert.equal(f.simulations[0].functionName, 'exitBid');
assert.ok(f.observations.every(o => o.blockNumber === 115n));
assert.ok(!f.observations.some(o => o.functionName === 'balanceOf'));

f = partialFixture(); f.checkpoints.set('120', checkpoint(1000n, 115n, sentinel));
exit = await prepareGenesisAuctionTransaction({ ...f.options, action: 'exitBid', bidId: '1' });
assert.deepEqual(decodeFunctionData({ abi: txAbi, data: exit.data }).args, [1n, 110n, 0n],
  'equal final clearing price uses outbidBlock zero');
f = partialFixture(); f.checkpoints.set('115', checkpoint(1200n, 110n, 120n));
exit = await prepareGenesisAuctionTransaction({ ...f.options, action: 'exitBid', bidId: '1' });
assert.deepEqual(decodeFunctionData({ abi: txAbi, data: exit.data }).args, [1n, 110n, 115n],
  'first strictly outbid checkpoint is used');

f = partialFixture(); f.checkpoints.clear();
exit = await prepareGenesisAuctionTransaction({ ...f.options, action: 'exitBid', bidId: '1',
  lastFullyFilledCheckpointBlock: '110', outbidBlock: '120' });
assert.deepEqual(decodeFunctionData({ abi: txAbi, data: exit.data }).args, [1n, 110n, 120n]);
assert.ok(!f.observations.some(o => o.functionName === 'checkpoints'), 'explicit hints are validated by simulation');
f = partialFixture();
await rejected({ ...f.options, action: 'exitBid', bidId: '1', lastFullyFilledCheckpointBlock: '110' }, 'invalid_input');
await rejected({ ...f.options, action: 'exitBid', bidId: '1', lastFullyFilledCheckpointBlock: '110',
  outbidBlock: (1n << 64n).toString() }, 'invalid_input');
f = partialFixture(); f.failSimulation();
await rejected({ ...f.options, action: 'exitBid', bidId: '1', lastFullyFilledCheckpointBlock: '110', outbidBlock: '120' }, 'simulation_failed');

for (const change of [
  p => p.checkpoints.set('115', checkpoint(1000n, 110n, 110n)), // cycle
  p => p.checkpoints.set('115', checkpoint(1000n, 110n, sentinel)), // final never checkpointed
  p => p.checkpoints.delete('120'),
  p => p.checkpoints.set('115', checkpoint(50n, 110n, 120n)), // clearing price fell
  p => p.checkpoints.set('115', checkpoint(1000n, 109n, 120n)), // backward link mismatch
]) {
  f = partialFixture(); change(f);
  await rejected({ ...f.options, action: 'exitBid', bidId: '1' }, 'exit_hints_required');
  assert.equal(f.simulations.length, 1, 'inconsistent derived hints are never offered');
}
f = partialFixture(); f.checkpoints.clear();
f.values.auction.bids[0] = 1n; f.values.auction.endBlock = 258n; f.values.auction.blockNumberish = 258n;
for (let n = 1n; n <= 258n; n++) f.checkpoints.set(n.toString(), checkpoint(n < 257n ? 100n : 1000n,
  n - 1n, n === 258n ? sentinel : n + 1n));
await assert.rejects(() => prepareGenesisAuctionTransaction({ ...f.options, action: 'exitBid', bidId: '1' }),
  e => e.code === 'exit_hints_required' && e.message.includes('256'));
assert.equal(f.observations.filter(o => o.functionName === 'checkpoints').length, 256);
f = fixture();
await rejected({ ...f.options, action: 'exitBid', bidId: '1' }, 'wrong_phase');
assert.equal(f.simulations.length, 0, 'automatic exit never introduces early auction exits');
f = fixture();
const originalRead = f.client.readContract;
f.client.readContract = async args => {
  if (args.functionName === 'balanceOf') throw Error('NFT index unavailable');
  return originalRead(args);
};
await prepareGenesisAuctionTransaction({ ...f.options, action: 'claimBid', bidId: '1' });
f = fixture();
f.options.manifest = { ...manifest, dependencies };
const depRead = f.client.readContract, depCode = f.client.getCode;
f.client.getCode = async args => {
  const found = Object.values(dependencies).find(p => p.address === args.address);
  return found ? `0x60${Number(BigInt(found.address)).toString(16)}` : depCode(args);
};
Object.assign(f.values.coordinator, Object.fromEntries(Object.entries(dependencies).filter(([n]) => n !== 'hook')
  .map(([n, p]) => [n, p.address])), {
  poolKey: [zero, contracts.omr.address, 3000, 60, dependencies.hook.address],
  hookCodeHash: dependencies.hook.runtimeCodeHash,
});
f.client.readContract = async args => args.address === dependencies.positionManager.address
  ? dependencies.poolManager.address : depRead(args);
await readGenesisAuction(f.options);
f.values.coordinator.poolKey[4] = other;
await assert.rejects(() => readGenesisAuction(f.options), { code: 'deployment_mismatch' });
f.options.manifest = { ...manifest, dependencies: { ...dependencies, hook: { address: dependencies.hook.address } } };
await assert.rejects(() => readGenesisAuction(f.options), { code: 'invalid_configuration' });
for (const badDependencies of [undefined, {}, { ...dependencies, hook: undefined },
  { ...dependencies, hook: { ...dependencies.hook, runtimeCodeHash: undefined } },
  { ...dependencies, hook: dependencies.permit2 }, { ...dependencies, hook: contracts.omr }]) {
  f = fixture(); f.options.manifest = { ...manifest, dependencies: badDependencies };
  await assert.rejects(() => readGenesisAuction(f.options), { code: 'invalid_configuration' });
  await rejected({ ...f.options, action: 'bid', amountEth: '1', maxPriceX96: '1000' }, 'invalid_configuration');
  await rejected({ ...f.options, action: 'claimBid', bidId: '1' }, 'invalid_configuration');
  assert.equal(f.simulations.length, 0, 'incomplete or aliased dependency pins never reach simulation');
}
console.log('genesis auction: pinned deployment, exact unsigned calldata, NFT admission, complete bid recovery and bounded checkpoint hints PASS');
