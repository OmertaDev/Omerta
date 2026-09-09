// Complete existing reserve-backed withdrawal requests after confirmed liquidity accounting.
// This never creates a signer, changes extraction configuration, or broadcasts a transaction.
import { getAddress, keccak256, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { chainConfig, drainQueue } from './chain.js';
import { validateLiquidityManifest } from './liquiditykeeper.js';

const lower = (v) => String(v || '').toLowerCase();
const HASH = /^0x[0-9a-f]{64}$/i;
const fail = (code) => { throw Object.assign(new Error(code), { keeperCode: code }); };

export async function drainLiquidityQueue(pool, { manifest, clients, indexed, keeperResult } = {}) {
  if (!process.env.VOUCHER_SIGNER_PK || !process.env.CHAIN_ID || !process.env.VOUCHER_CLAIM_ADDRESS)
    return { enabled: false, signed: 0, reason: 'voucher_signing_dormant' };
  if (indexed?.caughtUp !== true || keeperResult?.alert !== false)
    return { enabled: true, signed: 0, reason: 'liquidity_reconciliation_incomplete' };
  const m = validateLiquidityManifest(manifest), claim = m.contracts.claim, pub = clients?.publicClient;
  if (!claim || !pub) fail('claim_runtime_pin_required');
  const domain = chainConfig();
  if (domain.chainId !== m.chainId || lower(domain.verifyingContract) !== claim.address) fail('voucher_manifest_domain_mismatch');
  const rawKey = process.env.VOUCHER_SIGNER_PK;
  const key = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  if (!HASH.test(key)) fail('invalid_existing_voucher_signer');
  const signer = privateKeyToAccount(key).address;
  if (lower(signer) === m.keeper) fail('voucher_signer_is_liquidity_keeper');
  if (Number(await pub.getChainId()) !== m.chainId) fail('wrong_chain');
  const block = await pub.getBlock({ blockTag: 'latest' });
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (block.number == null || !HASH.test(block.hash || '') || block.timestamp == null
      || BigInt(block.timestamp) > now + 15n || now > BigInt(block.timestamp) + BigInt(m.gas.maxSnapshotAgeSeconds)) fail('stale_queue_chain_head');
  for (const pin of [claim, m.contracts.omr]) {
    const code = await pub.getCode({ address: pin.address, blockNumber: block.number });
    if (!code || code === '0x' || lower(keccak256(code)) !== pin.runtimeHash) fail('claim_runtime_mismatch');
  }
  const read = (signature) => pub.readContract({ address: getAddress(claim.address), abi: parseAbi([`function ${signature}`]),
    functionName: signature.split('(')[0], blockNumber: block.number });
  const [onchainSigner, omr, owner, paused] = await Promise.all([
    read('signer() view returns (address)'), read('omr() view returns (address)'),
    read('owner() view returns (address)'), read('paused() view returns (bool)'),
  ]);
  if (lower(onchainSigner) !== lower(signer)) fail('voucher_signer_binding_mismatch');
  if (lower(omr) !== m.contracts.omr.address || lower(owner) !== m.governanceSafe) fail('claim_dependency_binding_mismatch');
  if (paused) return { enabled: true, signed: 0, reason: 'claim_paused' };
  const balance = await pub.readContract({ address: m.contracts.omr.address, abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
    functionName: 'balanceOf', args: [claim.address], blockNumber: block.number });
  const canonical = await pub.getBlock({ blockNumber: block.number });
  if (canonical.number == null || BigInt(canonical.number) !== BigInt(block.number) || lower(canonical.hash) !== lower(block.hash)) fail('queue_claim_block_reorg');
  // Configuration is read again at the signing boundary; never temporarily rewrite globals
  // to make a different account/domain fit the already approved manifest.
  const still = chainConfig();
  if (still.chainId !== domain.chainId || lower(still.verifyingContract) !== lower(domain.verifyingContract)
      || process.env.VOUCHER_SIGNER_PK !== rawKey) fail('voucher_signing_configuration_changed');
  return { enabled: true, ...(await drainQueue(pool, { maxLiveClaimWei: BigInt(balance) })), blockNumber: String(block.number), blockHash: lower(block.hash) };
}
