import { encodeFunctionData, getAddress, parseAbi } from 'viem';
import { readGenesisAuction, GenesisAuctionError } from '../src/genesisauction.js';

const ABI = parseAbi(['function checkpointAuction()', 'function migrate()', 'function recoverTokenDust()',
  'function balanceOf(address) view returns(uint256)']);
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const fail = (code, message) => { throw new GenesisAuctionError(code, message); };

// A single unsigned dependency stage, bound to one canonical verified snapshot. No signing/broadcast.
export async function prepareGenesisAuctionOperations(options) {
  const { manifest, account, client } = options || {};
  const state = await readGenesisAuction(options, { recovery: true });
  const blockNumber = BigInt(state.snapshot.blockNumber), c = manifest.contracts;
  const planned = [], gates = [];
  let phase = state.phase;
  if (state.migration.succeeded) {
    phase = 'migration_complete';
    let dust;
    try { dust = BigInt(await client.readContract({ address: c.omr.address, abi: ABI,
      functionName: 'balanceOf', args: [c.coordinator.address], blockNumber })); }
    catch { fail('state_unavailable', 'Migration dust balance is unavailable; no operation is released.'); }
    if (dust > 0n) planned.push('recoverTokenDust');
    if (!state.migration.claimsOpen) gates.push('native_claim_cliff');
  } else if (BigInt(state.auction.nativeClock) < BigInt(state.auction.end)) gates.push('auction_end');
  else if (BigInt(state.migration.priceX96) === 0n) { phase = 'auction_checkpoint_ready'; planned.push('checkpointAuction'); }
  else if (!state.auction.graduated) { phase = 'auction_not_graduated'; gates.push('auction_graduation'); }
  else { phase = 'migration_ready'; planned.push('migrate'); }
  // The native claim cliff gates user token claims, never pool migration or dust recovery.
  const transactions = [];
  for (const functionName of planned) {
    try { await client.simulateContract({ account: getAddress(account), address: c.coordinator.address, abi: ABI,
      functionName, args: [], value: 0n, chain: { id: 4663 }, blockNumber }); }
    catch { fail('simulation_failed', 'An operation did not simulate; no calls are released.'); }
    transactions.push({ chainId: 4663, chainIdHex: '0x1237', from: getAddress(account), to: getAddress(c.coordinator.address),
      value: '0x0', valueWei: '0', functionName, data: encodeFunctionData({ abi: ABI, functionName, args: [] }) });
  }
  let final, chain;
  try { [final, chain] = await Promise.all([client.getBlock({ blockNumber }), client.getChainId()]); }
  catch { fail('state_unavailable', 'The operation snapshot could not be rechecked; no calls are released.'); }
  if (!same(final?.hash, state.snapshot.blockHash) || Number(chain) !== 4663)
    fail('state_unavailable', 'The operation snapshot changed; no calls are released.');
  return { sourceOnly: true, execution: 'unsigned-human-operator', phase, snapshot: state.snapshot,
    gates, transactions, nextInvocationRequired: transactions.length > 0 };
}
