import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeFunctionData, encodeAbiParameters, keccak256, parseAbi } from 'viem';
import { readGenesisAuction, prepareGenesisAuctionTransaction } from '../src/genesisauction.js';

const address = n => `0x${n.toString(16).padStart(40, '0')}`;
const account = address(99), other = address(100), validator = address(5);
const zero = address(0), blockHash = `0x${'ab'.repeat(32)}`;
const names = ['auction', 'coordinator', 'characterNft', 'omr', 'validator'];
const tickInterface = fs.readFileSync(new URL('../omerta-contracts/src/genesis-auction/vendor/cca/interfaces/ITickStorage.sol', import.meta.url), 'utf8');
assert.match(tickInterface, /function tickSpacing\(\)/, 'the pinned CCA interface exposes tickSpacing()');
const artifactNames = { auction: 'OmertaGuardedAuction', coordinator: 'OmertaAuctionCoordinatorV2', hook: 'OmertaHookV2',
  validator: 'GenesisCharacterBidValidation', omr: 'OMR', characterNft: 'DynastyNFT' };
const actualAbiFunctions = {};
for (const [role, contract] of Object.entries(artifactNames)) {
  const sourceName = contract === 'GenesisCharacterBidValidation' ? 'GenesisCharacterEligibility' : contract;
  const file = new URL(`../omerta-contracts/out/${sourceName}.sol/${contract}.json`, import.meta.url);
  if (fs.existsSync(file)) actualAbiFunctions[role] = new Set(JSON.parse(fs.readFileSync(file, 'utf8')).abi
    .filter(entry => entry.type === 'function').map(entry => entry.name));
}
if (actualAbiFunctions.auction) {
  assert.ok(actualAbiFunctions.auction.has('tickSpacing'));
  assert.ok(!actualAbiFunctions.auction.has('TICK_SPACING_Q96'), 'an internal immutable has no external getter');
}
const contracts = Object.fromEntries(names.map((name, i) => [name, {
  address: address(i + 1), runtimeCodeHash: keccak256(`0x60${(i + 1).toString(16).padStart(2, '0')}`),
}]));
const dependencies = Object.fromEntries(['poolManager', 'positionManager', 'permit2', 'hook'].map((name, i) =>
  [name, { address: address(11 + i), runtimeCodeHash: keccak256(`0x60${(11 + i).toString(16)}`) }]));
const safe = address(77);
const policy = { totalSupplyWei:'100000000000000000000000000',decimals:18,saleTokenAmountWei:'40000000000000000000000000',lpTokenAmountWei:'20000000000000000000000000',bondTokenAmountWei:'40000000000000000000000000',familySafe:safe,liquidityOwner:safe,unsoldRecipient:safe,bondReserveCustodian:safe,minimumRaiseWei:'10000000000000000000',lpProceedsBps:5000,claimsAtAuctionEnd:true };
const ceilFloor=((10n**19n<<96n)+BigInt(policy.saleTokenAmountWei)-1n)/BigInt(policy.saleTokenAmountWei);
const tick=(ceilFloor+99n)/100n,floor=tick*100n,bidPrice=floor+tick*1000n;
const founder = '0xA87b7A7eEcB6f4c771445f5cBa5bb0d4b29E5ceD';
const hookGovernance = { governanceSafe: safe, fixedFounderRecipient: founder, fixedFounderBps: 200, delaySeconds: 172800, executionSafeOnly: true };
const manifest = { chainId: 4663, contracts, dependencies, policy, hookGovernance };
const codes = Object.fromEntries(names.map((name, i) => [contracts[name].address, `0x60${(i + 1).toString(16).padStart(2, '0')}`]));
codes[validator] = '0x6005';
for (const pin of Object.values(dependencies)) codes[pin.address] = `0x60${Number(BigInt(pin.address)).toString(16)}`;
function fixture() {
  const values = {
    hook: { governanceSafe: safe, opsRecipient: founder, OPS_SELL_BPS: 200n, TAX_CONFIG_DELAY: 172800n,
      TAX_EXECUTION_SAFE_ONLY: true, baseSellBps: 900n, taxConfig: [160n, 240n, 300n, 100n],
      queuedTaxHash: `0x${'00'.repeat(32)}`, queuedTaxExecuteAfter: 0n, taxConfigNonce: 0n },
    auction: { characterNft: contracts.characterNft.address, token: contracts.omr.address, currency: zero,
      launchGate: contracts.coordinator.address, fundsRecipient: contracts.coordinator.address,
      launchGateCodeHash: contracts.coordinator.runtimeCodeHash, launchChainId: 4663n,
      validationHook: validator, blockNumberish: 115n, startBlock: 110n, endBlock: 120n, claimBlock: 120n,
      floorPrice: floor, MAX_BID_PRICE: 10n**30n, tickSpacing: tick, isGraduated: true, nextBidId: 2n,
      bids: [110n, 1n, 0n, bidPrice, account, 1n << 96n, 0n], totalSupply:BigInt(policy.saleTokenAmountWei), tokensRecipient:safe, minimumRaiseWei:BigInt(policy.minimumRaiseWei), currencyRaised:10n**19n, clearingPrice:floor+tick*100n },
    coordinator: { auction: contracts.auction.address, characterNft: contracts.characterNft.address, characterNftCodeHash: contracts.characterNft.runtimeCodeHash, validatorCodeHash: contracts.validator.runtimeCodeHash,
      omr: contracts.omr.address, auctionCodeHash: contracts.auction.runtimeCodeHash,
      poolManager: dependencies.poolManager.address, positionManager: dependencies.positionManager.address,
      permit2: dependencies.permit2.address, hookCodeHash: dependencies.hook.runtimeCodeHash,
      poolKey: [zero, contracts.omr.address, 3000, 60, dependencies.hook.address], chainId: 4663n,
      safe,familyYieldTreasury:safe,liquidityOwner:safe,tokenReserve:BigInt(policy.lpTokenAmountWei), poolPriceX96:0n,lpNativeBudget:0n,publicProceeds:0n,migrationSucceeded: false, playerClaimsOpen: false, auctionPriceX96: 0n },
    omr:{totalSupply:BigInt(policy.totalSupplyWei),decimals:18}, characterNft: { balanceOf: 1n },
    validator: { characterNft: contracts.characterNft.address, characterNftCodeHash: contracts.characterNft.runtimeCodeHash,
      omr: contracts.omr.address, omrCodeHash: contracts.omr.runtimeCodeHash, approvedSupply: BigInt(policy.totalSupplyWei),
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
      if (args.address === dependencies.hook.address) {
        if (actualAbiFunctions.hook) assert.ok(actualAbiFunctions.hook.has(args.functionName), `real hook ABI exposes ${args.functionName}`);
        assert.ok(Object.hasOwn(values.hook, args.functionName)); return values.hook[args.functionName];
      }
      if (args.address === dependencies.positionManager.address && args.functionName === 'poolManager')
        return dependencies.poolManager.address;
      const name = args.address.toLowerCase() === validator ? 'validator'
        : names.find(n => contracts[n].address === args.address.toLowerCase());
      assert.ok(name, 'all contract reads target manifest contracts or pinned auction validator');
      if (actualAbiFunctions[name]) assert.ok(actualAbiFunctions[name].has(args.functionName), `real ${name} ABI exposes ${args.functionName}`);
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
const bid = await prepareGenesisAuctionTransaction({...f.options,action:'bid',amountEth:'0.123456789012345678',maxPriceX96:bidPrice.toString(),to:other,data:'0xdeadbeef'});
assert.deepEqual(decodeFunctionData({abi:txAbi,data:bid.data}).args,[bidPrice,123456789012345678n,account,'0x']);
assert.equal(bid.to.toLowerCase(),contracts.auction.address);assert.equal(bid.valueWei,'123456789012345678');
assert.ok(f.observations.every(o=>o.blockNumber===115n));assert.equal(f.simulations.at(-1).blockNumber,115n);
assert.doesNotThrow(()=>JSON.stringify(state));assert.doesNotThrow(()=>JSON.stringify(bid));
assert.equal(state.auction.tickSpacingQ96, tick.toString());
await rejected({...f.options, action:'bid', amountEth:'1', maxPriceX96:(floor+1001n).toString()}, 'invalid_input');
assert.equal(f.simulations.length, 1, 'off-tick bids are rejected before simulation');
assert.ok(f.observations.some(o => o.functionName === 'tickSpacing' && o.blockNumber === 115n));
for(const action of ['contribute','claimPlayer','refundPlayer','transfer']) await rejected({...f.options,action},'invalid_input');
for(const amountEth of ['0','-1','1e-3','0.0000000000000000001','01',0.1,'9'.repeat(120)]) await rejected({...f.options,action:'bid',amountEth,maxPriceX96:bidPrice.toString()},'invalid_input');
f=fixture();f.values.characterNft.balanceOf=0n; await rejected({...f.options,action:'bid',amountEth:'1',maxPriceX96:bidPrice.toString()},'nft_required');
f.values.auction.blockNumberish=120n;
for(const action of ['exitBid','claimBid']) { const tx=await prepareGenesisAuctionTransaction({...f.options,action,bidId:'1'});assert.equal(tx.value,'0x0'); }
assert.equal(f.observations.filter(o=>o.functionName==='balanceOf').length,1,'only rejected bid reads NFTbalance');
f.values.auction.bids[4]=other;await rejected({...f.options,action:'claimBid',bidId:'1'},'bid_owner');
f=fixture();f.values.auction.blockNumberish=120n;f.reorg();await rejected({...f.options,action:'claimBid',bidId:'1'},'state_unavailable');
f=fixture();f.chain(1);await rejected({...f.options,action:'bid',amountEth:'1',maxPriceX96:bidPrice.toString()},'deployment_mismatch');
f=fixture();f.badCode();await assert.rejects(()=>readGenesisAuction(f.options),{code:'deployment_mismatch'});
f=fixture();f.badValidator();await assert.rejects(()=>readGenesisAuction(f.options),{code:'deployment_mismatch'});
f=fixture();f.values.auction.blockNumberish=120n;f.failSimulation();await rejected({...f.options,action:'claimBid',bidId:'1'},'simulation_failed');
for(const timestamp of [879n,1031n]){ f=fixture();f.timestamp(timestamp);await assert.rejects(()=>readGenesisAuction(f.options),{code:'state_unavailable'}); }
const sentinel = (1n << 64n) - 1n;
const checkpoint = (price, prev, next) => [floor+price*tick, 0n, 0n, 1n, prev, next];
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
f.values.auction.bids[0] = 1n; f.values.auction.endBlock = 258n; f.values.auction.claimBlock=258n; f.values.auction.blockNumberish = 258n;
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
f.values.auction.blockNumberish=120n;
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
  await rejected({ ...f.options, action: 'bid', amountEth: '1', maxPriceX96: bidPrice.toString() }, 'invalid_configuration');
  await rejected({ ...f.options, action: 'claimBid', bidId: '1' }, 'invalid_configuration');
  assert.equal(f.simulations.length, 0, 'incomplete or aliased dependency pins never reach simulation');
}
console.log('genesis auction: pinned deployment, exact unsigned calldata, NFT admission, complete bid recovery and bounded checkpoint hints PASS');
f = fixture();
await rejected({ ...f.options, action: 'claimBid', bidId: '1' }, 'wrong_phase');
assert.equal(f.simulations.length, 0);
f.values.auction.blockNumberish = 120n; f.values.auction.bids[2] = 120n;
f.values.coordinator.playerClaimsOpen = true;
f.values.characterNft.balanceOf = 0n;
const closureClaim = await prepareGenesisAuctionTransaction({ ...f.options, action: 'claimBid', bidId: '1' });
assert.equal(closureClaim.value, '0x0');
assert.equal(f.values.coordinator.migrationSucceeded, false, 'claims do not wait for LP migration');
assert.ok(!f.observations.some(o => o.functionName === 'balanceOf'));
const simulateClosure = f.client.simulateContract;
f.client.simulateContract = async args => {
  if (args.functionName === 'claimTokens' && (!f.values.auction.isGraduated || f.values.auction.bids[2] === 0n))
    throw Error('underlying auction requires graduated, exited bid');
  return simulateClosure(args);
};
f.values.auction.isGraduated = false;
await rejected({ ...f.options, action: 'claimBid', bidId: '1' }, 'wrong_phase');
const failedAuction = await readGenesisAuction(f.options, { recovery: true });
assert.equal(failedAuction.migration.claimsOpen, false, 'closure alone does not create claimable purchases in a failed auction');
assert.equal(f.values.coordinator.playerClaimsOpen, true, 'the compatible contract gate remains time-only');
const failedExit = await prepareGenesisAuctionTransaction({ ...f.options, action: 'exitBid', bidId: '1' });
assert.equal(failedExit.value, '0x0', 'failed graduation preserves bid exit and ETH recovery');
f.values.auction.isGraduated = true; f.values.auction.bids[2] = 0n;
await rejected({ ...f.options, action: 'claimBid', bidId: '1' }, 'simulation_failed');
for (const changed of [{ ...policy, lpProceedsBps: 3750 }, { ...policy, saleTokenAmountWei: '4410000000000000000000000' },
  { ...policy, bondReserveCustodian: other }, undefined]) {
  f = fixture(); f.options.manifest = { ...manifest, policy: changed };
  await assert.rejects(() => readGenesisAuction(f.options), { code: 'invalid_configuration' });
}
for (const change of [
  f => { f.values.coordinator.familyYieldTreasury = other; },
  f => { f.values.coordinator.liquidityOwner = other; },
  f => { f.values.coordinator.tokenReserve = 1n; },
  f => { f.values.auction.totalSupply = 1n; },
  f => { f.values.auction.minimumRaiseWei = 1n; },
  f => { f.values.auction.claimBlock = 130n; },
  f => { f.values.auction.floorPrice = floor - 2n; },
]) {
  f = fixture(); change(f);
  await assert.rejects(() => readGenesisAuction(f.options), { code: 'deployment_mismatch' });
}
f = fixture(); f.values.auction.blockNumberish = 120n;
Object.assign(f.values.coordinator, { migrationSucceeded: true, playerClaimsOpen: true,
  auctionPriceX96: floor + 1000n, publicProceeds: 10n ** 19n, lpNativeBudget: 5n * 10n ** 18n,
  poolPriceX96: (5n * 10n ** 18n << 96n) / BigInt(policy.lpTokenAmountWei) });
const funded = await readGenesisAuction(f.options);
assert.notEqual(funded.auction.finalClearingPriceX96, funded.migration.fundedPoolPriceX96);
assert.equal(funded.migration.lpNativeBudgetWei, '5000000000000000000');
assert.equal(funded.policy.bondTokenAmountWei, '40000000000000000000000000');
assert.ok(!Object.hasOwn(funded.migration, 'priceX96'), 'LP price has no ambiguous auction-price alias');
f.values.coordinator.lpNativeBudget = 1n;
await assert.rejects(() => readGenesisAuction(f.options), { code: 'deployment_mismatch' });
console.log('Founder terms verified: allocation/Safe/minimum raise/floor, closure claims independent of LP, and distinct funded LP budget/price PASS');
f = fixture(); f.values.omr.totalSupply += 1n;
await rejected({ ...f.options, action: 'bid', amountEth: '1', maxPriceX96: bidPrice.toString() }, 'deployment_mismatch');
f.values.auction.blockNumberish = 120n; f.values.auction.bids[2] = 120n;
const recoveryRead = f.client.readContract;
f.client.readContract = async args => {
  if ((args.address === contracts.omr.address && args.functionName === 'totalSupply')
    || (args.address === contracts.characterNft.address && args.functionName === 'balanceOf'))
    throw Error('mutable admission-only read must not be requested');
  return recoveryRead(args);
};
for (const action of ['exitBid', 'claimBid']) {
  const recovered = await prepareGenesisAuctionTransaction({ ...f.options, action, bidId: '1' });
  assert.equal(recovered.value, '0x0');
}
await readGenesisAuction(f.options, { recovery: true });
f.values.omr.decimals = 6;
await rejected({ ...f.options, action: 'claimBid', bidId: '1' }, 'deployment_mismatch');
console.log('Mutable OMR supply drift blocks admission, preserves immutable recovery and avoids NFT balance reads PASS');
for (const change of [
  f => { delete f.values.validator.omr; },
  f => { f.values.validator.omr = other; },
  f => { f.values.validator.omrCodeHash = blockHash; },
  f => { f.values.validator.approvedSupply = 1n; },
]) {
  f = fixture(); change(f);
  await assert.rejects(() => readGenesisAuction(f.options));
  await assert.rejects(() => readGenesisAuction(f.options, { recovery: true }));
  assert.equal(f.simulations.length, 0);
}
console.log('Validator OMR identity, runtime and immutable approved-supply snapshot bindings PASS');
f = fixture();
Object.assign(f.values.hook, { baseSellBps: 750n, taxConfig: [150n, 200n, 200n, 200n],
  queuedTaxHash: blockHash, queuedTaxExecuteAfter: 200000n, taxConfigNonce: 2n });
const governed = await readGenesisAuction(f.options);
assert.equal(governed.hookTax.baseSellBps, '750', 'legitimate executed changes need not equal the initial 900 bps');
assert.equal(governed.hookTax.fixedFounderBps, 200);
assert.equal(governed.hookTax.executionSafeOnly, true);
assert.equal(governed.hookTax.delaySeconds, 172800);
assert.match(governed.hookTax.committeeProposalProcess, /offchain/);
for (const change of [f => { f.values.hook.governanceSafe = other; }, f => { f.values.hook.opsRecipient = other; },
  f => { f.values.hook.OPS_SELL_BPS = 201n; }, f => { f.values.hook.TAX_CONFIG_DELAY = 1n; },
  f => { f.values.hook.TAX_EXECUTION_SAFE_ONLY = false; }, f => { f.values.hook.baseSellBps = 800n; },
  f => { f.values.hook.taxConfig = [160n, 240n, 300n, 101n]; }]) {
  f = fixture(); change(f);
  await assert.rejects(() => readGenesisAuction(f.options), { code: 'deployment_mismatch' });
  await assert.rejects(() => readGenesisAuction(f.options, { recovery: true }), { code: 'deployment_mismatch' });
}
f = fixture(); f.options.manifest = { ...manifest, hookGovernance: undefined };
await assert.rejects(() => readGenesisAuction(f.options), { code: 'invalid_configuration' });
console.log('Immutable founder 2%/recipient and 48h Safe-only governance pins verified; future bounded rates accepted PASS');
