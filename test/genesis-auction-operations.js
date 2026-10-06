import assert from 'node:assert/strict';
import { decodeFunctionData, keccak256, parseAbi } from 'viem';
import { prepareGenesisAuctionOperations } from '../tools/genesis-auction-operations.js';

const address = n => `0x${n.toString(16).padStart(40, '0')}`;
const account = address(99), other = address(100), validator = address(5);
const zero = address(0), blockHash = `0x${'ab'.repeat(32)}`;
const names = ['auction', 'coordinator', 'characterNft', 'omr', 'validator'];
const contracts = Object.fromEntries(names.map((name, i) => [name, {
  address: address(i + 1), runtimeCodeHash: keccak256(`0x60${(i + 1).toString(16).padStart(2, '0')}`),
}]));
const dependencies = Object.fromEntries(['poolManager', 'positionManager', 'permit2', 'hook'].map((name, i) => [name, {
  address: address(i + 11), runtimeCodeHash: keccak256(`0x60${(i + 11).toString(16).padStart(2, '0')}`),
}]));
const manifest = { chainId: 4663, contracts, dependencies };
const codes = Object.fromEntries(names.map((name, i) => [contracts[name].address, `0x60${(i + 1).toString(16).padStart(2, '0')}`]));
codes[validator] = '0x6005';
for (const [i, name] of Object.keys(dependencies).entries()) codes[dependencies[name].address] = `0x60${(i + 11).toString(16).padStart(2, '0')}`;
function fixture() {
  const values = {
    auction: { characterNft: contracts.characterNft.address, token: contracts.omr.address, currency: zero,
      launchGate: contracts.coordinator.address, fundsRecipient: contracts.coordinator.address,
      launchGateCodeHash: contracts.coordinator.runtimeCodeHash, launchChainId: 4663n,
      validationHook: validator, blockNumberish: 115n, startBlock: 110n, endBlock: 120n, claimBlock: 130n,
      floorPrice: 100n, TICK_SPACING_Q96: 2n, MAX_BID_PRICE: 100000n, isGraduated: true, nextBidId: 2n,
      bids: [110n, 1n, 0n, 1000n, account, 1n << 96n, 0n] },
    coordinator: { auction: contracts.auction.address, characterNft: contracts.characterNft.address, characterNftCodeHash: contracts.characterNft.runtimeCodeHash, validatorCodeHash: contracts.validator.runtimeCodeHash,
      omr: contracts.omr.address, auctionCodeHash: contracts.auction.runtimeCodeHash,
      poolManager: dependencies.poolManager.address, positionManager: dependencies.positionManager.address, permit2: dependencies.permit2.address,
      poolKey: [zero, contracts.omr.address, 3000, 60, dependencies.hook.address], hookCodeHash: dependencies.hook.runtimeCodeHash,
      chainId: 4663n,
      migrationSucceeded: false, playerClaimsOpen: false, auctionPriceX96: 0n },
    characterNft: { balanceOf: 1n },
    omr: { balanceOf: 0n },
    positionManager: { poolManager: dependencies.poolManager.address },
    validator: { characterNft: contracts.characterNft.address, characterNftCodeHash: contracts.characterNft.runtimeCodeHash,
      eligibilityChainId: 4663n },
  };
  let chain = 4663, changedHash = false, badCode = false, simulationFails = false, timestamp = 1000n;
  let simpleExitFails = false, badValidator = false, nftBalanceFails = false, reorgOnSimulation = false, chainOnSimulation = false;
  const checkpoints = new Map();
  const observations = [], simulations = [];
  const client = {
    getChainId: async () => chain,
    getBlock: async args => ({ number: 115n, timestamp, hash: args?.blockNumber && changedHash ? `0x${'cd'.repeat(32)}` : blockHash }),
    getCode: async args => { observations.push(args); return badCode || (badValidator && args.address.toLowerCase() === validator)
      ? '0x6000' : codes[args.address.toLowerCase()]; },
    readContract: async args => {
      observations.push(args);
      if (nftBalanceFails && args.address.toLowerCase() === contracts.characterNft.address && args.functionName === 'balanceOf') throw Error('NFT balance unavailable');
      const name = args.address.toLowerCase() === validator ? 'validator'
        : names.find(n => contracts[n].address === args.address.toLowerCase())
          || Object.keys(dependencies).find(n => dependencies[n].address === args.address.toLowerCase());
      assert.ok(name, 'all contract reads target manifest contracts or pinned auction validator');
      if (args.functionName === 'checkpoints') return checkpoints.get(args.args[0].toString()) || [0n, 0n, 0n, 0n, 0n, 0n];
      assert.ok(Object.hasOwn(values[name], args.functionName), `fixture knows ${name}.${args.functionName}`);
      return values[name][args.functionName];
    },
    simulateContract: async args => { simulations.push(args); if(reorgOnSimulation) changedHash=true; if(chainOnSimulation) chain=1;
      if (simulationFails || (simpleExitFails && args.functionName === 'exitBid')) throw new Error('sensitive RPC details'); },
  };
  return { values, client, observations, simulations, options: { manifest, account, client, nowMs: 1000000 },
    chain: n => { chain = n; }, reorg: () => { changedHash = true; }, badCode: () => { badCode = true; },
    failSimulation: () => { simulationFails = true; }, timestamp: n => { timestamp = n; },
    nftBalanceFails: () => { nftBalanceFails=true; }, reorgOnSimulation: () => { reorgOnSimulation=true; }, chainOnSimulation: () => { chainOnSimulation=true; }, simpleExitFails: () => { simpleExitFails = true; }, badValidator: () => { badValidator = true; }, checkpoints };
}

const ABI = parseAbi(['function checkpointAuction()', 'function migrate()', 'function recoverTokenDust()']);
async function plan(f) {
  const result = await prepareGenesisAuctionOperations(f.options);
  assert.doesNotThrow(() => JSON.stringify(result));
  for (const tx of result.transactions) {
    assert.equal(tx.value, '0x0'); assert.equal(tx.valueWei, '0'); assert.equal(tx.chainId, 4663);
    assert.equal(tx.from.toLowerCase(), account); assert.equal(tx.to.toLowerCase(), contracts.coordinator.address);
    assert.equal(decodeFunctionData({ abi: ABI, data: tx.data }).functionName, tx.functionName);
  }
  assert(f.observations.every(r => r.blockNumber === 115n), 'Every contract/code read is fixed to the verified snapshot');
  assert(f.simulations.every(s => s.blockNumber === 115n && s.value === 0n), 'Every operation simulates zero ETH at that snapshot');
  assert.equal(f.observations.filter(r => r.address?.toLowerCase() === contracts.characterNft.address && r.functionName === 'balanceOf').length, 0,
    'Operator progress never depends on an NFT admission balance');
  assert.equal(Object.hasOwn(result, 'participants'), false, 'No player-roster settlement');
  return result;
}
const calls = p => p.transactions.map(t => t.functionName);
function ended(f) { f.values.auction.blockNumberish = 120n; }
function priced(f) { ended(f); f.values.coordinator.auctionPriceX96 = 100n; }
const reject = (f, code) => assert.rejects(() => prepareGenesisAuctionOperations(f.options), { code });

let f = fixture(); assert.deepEqual((await plan(f)).gates, ['auction_end']); assert.equal(f.simulations.length, 0);
ended(f); assert.deepEqual(calls(await plan(f)), ['checkpointAuction']);
f = fixture(); ended(f); f.values.auction.isGraduated = false;
assert.deepEqual(calls(await plan(f)), ['checkpointAuction'], 'Final checkpoint can establish graduation; stale pre-checkpoint bool cannot deadlock progress');
f = fixture(); priced(f); f.values.auction.claimBlock = 10000n;
assert.deepEqual(calls(await plan(f)), ['migrate'], 'Future native claim cliff never delays migration');
assert.deepEqual((await plan(f)).gates, []);
assert.equal(f.simulations.at(-1).functionName, 'migrate');
f = fixture(); priced(f); f.nftBalanceFails(); assert.deepEqual(calls(await plan(f)), ['migrate']);
f = fixture(); priced(f); f.values.characterNft.balanceOf = 0n; assert.deepEqual(calls(await plan(f)), ['migrate']);
f = fixture(); priced(f); f.values.auction.isGraduated = false;
assert.deepEqual((await plan(f)).gates, ['auction_graduation']); assert.deepEqual(calls(await plan(f)), []);
f = fixture(); priced(f); f.values.coordinator.migrationSucceeded = true; f.values.omr.balanceOf = 10n;
let result = await plan(f); assert.deepEqual(calls(result), ['recoverTokenDust']); assert.deepEqual(result.gates, ['native_claim_cliff']);
f.values.omr.balanceOf = 0n; assert.deepEqual(calls(await plan(f)), []);
f.values.coordinator.playerClaimsOpen = true; assert.deepEqual((await plan(f)).gates, []);
f = fixture(); ended(f); f.failSimulation(); await reject(f, 'simulation_failed');
f = fixture(); priced(f); f.failSimulation(); await reject(f, 'simulation_failed');
f = fixture(); f.chain(1); await reject(f, 'deployment_mismatch');
f = fixture(); f.badCode(); await reject(f, 'deployment_mismatch');
f = fixture(); f.badValidator(); await reject(f, 'deployment_mismatch');
f = fixture(); f.reorg(); await reject(f, 'state_unavailable');
f = fixture(); priced(f); f.reorgOnSimulation(); await reject(f, 'state_unavailable');
f = fixture(); priced(f); f.chainOnSimulation(); await reject(f, 'state_unavailable');
f = fixture(); f.options.nowMs = 2000000; await reject(f, 'state_unavailable');
f = fixture(); f.values.coordinator.characterNftCodeHash = `0x${'ff'.repeat(32)}`; await reject(f, 'deployment_mismatch');
f = fixture(); f.values.coordinator.validatorCodeHash = `0x${'ff'.repeat(32)}`; await reject(f, 'deployment_mismatch');
f = fixture(); f.options.manifest = { ...manifest, contracts: { ...contracts, playerSale: contracts.auction } };
await reject(f, 'invalid_configuration');
f = fixture(); f.options.manifest = { chainId: 4663, contracts }; await reject(f, 'invalid_configuration');
f = fixture(); f.values.coordinator.hookCodeHash = `0x${'ff'.repeat(32)}`; await reject(f, 'deployment_mismatch');
f = fixture(); f.values.positionManager.poolManager = contracts.omr.address; await reject(f, 'deployment_mismatch');
console.log('Single-auction unsigned operations PASS: staged checkpoint/migrate/dust, no NFT balance dependency, claim cliff independent, zero ETH exact calldata/simulation, immutable/runtime pins, stale/reorg/chain/simulation rejection.');
