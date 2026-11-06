// Player purchases reserve prefunded OMR in the reviewed inventory bond on Robinhood Chain.
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { createPublicClient, encodeAbiParameters, encodeFunctionData, getAddress, http, isAddress,
  keccak256, parseAbi, parseEther, toHex, zeroAddress } from 'viem';
import { genesisSnapshotTransport } from './genesisrpc.js';
import { GameError } from './game.js';

const CHAIN_ID = 4663;
const HASH = /^0x[0-9a-f]{64}$/i;
const abi = parseAbi([
  'function safe() view returns (address)', 'function manager() view returns (address)',
  'function proceedsRecipient() view returns (address)', 'function poolId() view returns (bytes32)',
  'function omr() view returns (address)', 'function marketState() view returns (address)',
  'function availableInventory() view returns (uint256)', 'function outstandingClaims() view returns (uint256)',
  'function paused() view returns (bool)', 'function vestingSeconds() view returns (uint32)',
  'function discountBps() view returns (uint16)', 'function policySealed() view returns (bool)',
  'function isRecipient(address) view returns (bool)', 'function operatorRole(address) view returns (uint8)',
  'function isOperator(address) view returns (bool)', 'function balanceOf(address) view returns (uint256)',
  'struct Snapshot { uint64 epoch; uint64 observedAt; int24 meanTick; uint24 volatilityTicks; uint128 minLiquidity; uint256 omrPerEth; uint16 stressBps; uint16 sellImbalanceBps; bool valid; }',
  'function snapshot() view returns (Snapshot)',
  'function quote(uint256 nativeAmount, uint64 expectedEpoch) view returns (uint256)',
  'function purchase(uint64 expectedEpoch, uint256 minimumOmr, uint64 deadline, bytes32 nonce) payable returns (bytes32 id, uint256 amount)',
]);
const invalid = () => { throw new GameError('bond_input', 'Request a fresh quote for the exact ETH amount and linked wallet.'); };
const closed = () => { throw new GameError('bond_unavailable', 'Inventory bond purchases require a verified, active and funded market.'); };
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const nonzeroHash = s => HASH.test(s || '') && !/^0x0+$/.test(s);
const address = s => isAddress(s || '') && !same(s, zeroAddress);

export function loadInventoryBondCheckout(env = process.env) {
  const file = env === process.env ? process.env.INVENTORY_BOND_MANIFEST_PATH : env.INVENTORY_BOND_MANIFEST_PATH;
  const digest = env === process.env ? process.env.INVENTORY_BOND_MANIFEST_SHA256 : env.INVENTORY_BOND_MANIFEST_SHA256;
  if (!file && !digest) return null;
  if (!file || !/^[0-9a-f]{64}$/i.test(digest || '')) throw Error('Incomplete inventory bond deployment pin.');
  const stat = statSync(file);
  if (!stat.isFile() || stat.size > 65536) throw Error('Invalid inventory bond deployment file.');
  const bytes = readFileSync(file);
  if (createHash('sha256').update(bytes).digest('hex') !== digest.toLowerCase()) throw Error('Inventory bond manifest hash mismatch.');
  const manifest = JSON.parse(bytes);
  checkManifest(manifest);
  if (env.CHAIN_ID && Number(env.CHAIN_ID) !== CHAIN_ID) throw Error('Inventory bond pin requires Robinhood Chain.');
  if (!env.CHAIN_RPC_URL) throw Error('Inventory bond verification requires the approved chain RPC.');
  return { manifest, client: createPublicClient({ transport: genesisSnapshotTransport(http(env.CHAIN_RPC_URL, { retryCount: 0, timeout: 8000 })) }) };
}

function checkManifest(m) {
  if (m?.chainId !== CHAIN_ID || m?.approval !== 'inventory-bond-purchases' || m.contract !== 'OmertaInventoryBondV2'
    || !nonzeroHash(m.poolId) || !address(m.safe) || !address(m.proceedsRecipient)) closed();
  const pins = ['bond', 'marketState', 'omr', 'manager'].map(key => m.contracts?.[key]);
  if (pins.some(pin => !address(pin?.address) || !nonzeroHash(pin?.runtimeCodeHash))
    || new Set(pins.map(pin => pin.address.toLowerCase())).size !== pins.length) closed();
}

export async function inventoryBondTransaction(checkout, buyer, body, { prepare = false, now = Date.now() } = {}) {
  if (!checkout) closed();
  if (!address(buyer)) throw new GameError('wallet', 'Link your wallet before requesting a bond quote.');
  if (!body || typeof body.principalEth !== 'string' || body.principalEth.length > 60
    || !/^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/.test(body.principalEth)) invalid();
  const value = parseEther(body.principalEth);
  if (!value || value >= (1n << 128n)) invalid();
  const { manifest, client } = checkout;
  checkManifest(manifest);
  const { bond, manager, marketState, omr } = manifest.contracts;
  const allowed = prepare ? ['principalEth','buyer','to','chainId','epoch','minimumOmr','deadline','nonce'] : ['principalEth'];
  if (Object.keys(body).some(key => !allowed.includes(key))) invalid();
  if (prepare && (!same(body.buyer, buyer) || !same(body.to, bond.address) || body.chainId !== CHAIN_ID
    || !nonzeroHash(body.nonce) || !/^[1-9]\d{0,19}$/.test(body.epoch || '')
    || !/^[1-9]\d{0,77}$/.test(body.minimumOmr || '') || !Number.isSafeInteger(body.deadline))) invalid();
  try {
    if (await client.getChainId() !== CHAIN_ID) closed();
    const block = await client.getBlock({ blockTag: 'latest' });
    const wall = Math.floor(now / 1000);
    if (typeof block.number !== 'bigint' || !nonzeroHash(block.hash) || typeof block.timestamp !== 'bigint'
      || Number(block.timestamp) < wall - 60 || Number(block.timestamp) > wall + 15) closed();
    const read = (pin, functionName, args = []) => client.readContract({ address: pin.address, abi, functionName, args, blockNumber: block.number });
    await Promise.all([bond, marketState, omr, manager].map(async pin => {
      const code = await client.getCode({ address: pin.address, blockNumber: block.number });
      if (!code || code === '0x' || !same(keccak256(code), pin.runtimeCodeHash)) closed();
    }));
    const [safe, recipient, token, source, poolManager, poolId, paused, available, owed, collateral, sealed,
      canReceive, custody, operator, snapshot, vestingSeconds, discountBps] = await Promise.all([
      read(bond,'safe'), read(bond,'proceedsRecipient'), read(bond,'omr'), read(bond,'marketState'),
      read(bond,'manager'), read(bond,'poolId'), read(bond,'paused'), read(bond,'availableInventory'),
      read(bond,'outstandingClaims'), read(omr,'balanceOf',[bond.address]), read(omr,'policySealed'),
      read(omr,'isRecipient',[buyer]), read(omr,'operatorRole',[bond.address]), read(omr,'isOperator',[bond.address]),
      read(marketState,'snapshot'), read(bond,'vestingSeconds'), read(bond,'discountBps'),
    ]);
    if (paused !== false || !available || collateral < available + owed || sealed !== true || operator !== true || Number(custody) !== 2
      || !same(safe,manifest.safe) || !same(recipient,manifest.proceedsRecipient) || !same(token,omr.address)
      || !same(source,marketState.address) || !same(poolManager,manager.address) || !same(poolId,manifest.poolId)
      || snapshot.valid !== true || !snapshot.epoch) closed();
    if (!canReceive) throw new GameError('wallet', 'Your linked wallet must be eligible to receive OMR before buying a bond.');
    const amount = await read(bond,'quote',[value,snapshot.epoch]);
    if (!amount || amount > available) closed();
    const deadline = prepare ? body.deadline : Number(block.timestamp) + 120;
    if (deadline <= wall || deadline <= Number(block.timestamp) || deadline > Number(block.timestamp) + 120
      || (prepare && (body.epoch !== String(snapshot.epoch) || body.minimumOmr !== String(amount)))) invalid();
    const nonce = prepare ? body.nonce : '0x' + randomBytes(32).toString('hex');
    const args = [snapshot.epoch, amount, BigInt(deadline), nonce];
    const noteId = keccak256(encodeAbiParameters([{type:'uint256'},{type:'address'},{type:'address'},{type:'bytes32'}],
      [BigInt(CHAIN_ID), bond.address, buyer, nonce]));
    // quote() checks the oracle and price. Only purchase() enforces all budgets, inventory and replay.
    const simulation = await client.simulateContract({ address: bond.address, abi, functionName:'purchase', args,
      account: getAddress(buyer), value, blockNumber: block.number });
    if (!same(simulation.result?.[0], noteId) || simulation.result[1] !== amount) closed();
    const intent = { principalEth: body.principalEth, buyer: getAddress(buyer), to: getAddress(bond.address),
      chainId: CHAIN_ID, epoch: String(snapshot.epoch), minimumOmr: String(amount), deadline, nonce };
    return { intent, noteId, vestingSeconds: Number(vestingSeconds), discountBps: Number(discountBps),
      blockNumber: String(block.number), blockHash: block.hash,
      ...(prepare ? { value: toHex(value), data: encodeFunctionData({ abi, functionName:'purchase',args }) } : {}) };
  } catch (error) {
    if (error instanceof GameError) throw error;
    closed();
  }
}
