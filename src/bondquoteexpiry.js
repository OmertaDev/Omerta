// Release only chain-proven unused, expired bond quote reservations. All RPC work finishes
// before the lifetime budget lock; unsupported finality or ambiguous reads preserve reservations.
import { getAddress, keccak256, parseAbi } from 'viem';
import { liquidityKeeperConfig, makeLiquidityKeeperClients, validateLiquidityManifest } from './liquiditykeeper.js';

const MAX_CANDIDATES = 100;
const HASH = /^0x[0-9a-f]{64}$/i;
const ABI = parseAbi(['function usedNonce(uint256 nonce) view returns (bool)']);
const lower = (value) => String(value || '').toLowerCase();
const uint = (value) => {
  if (!/^(0|[1-9][0-9]*)$/.test(String(value ?? ''))) throw new Error('invalid_expiry_integer');
  return BigInt(value);
};

/** Internal dependency injection supports deterministic tests; HTTP callers cannot supply it.
 * The default path loads the pinned public manifest, uses read-only clients and reads no keys.
 * Legacy quotes without their original chain/address remain reserved for explicit reconciliation.
 */
export async function releaseExpiredBondQuotes(pool, {
  config, publicClient, now = Date.now(), env = process.env,
} = {}) {
  let manifest, bond, wallSeconds;
  try {
    if (!Number.isFinite(now) || now < 0) throw new Error('invalid_expiry_clock');
    wallSeconds = BigInt(Math.floor(now / 1000));
    config ||= liquidityKeeperConfig(env);
    if (!config.enabled) return { examined: 0, released: 0, held: 0, reason: 'expiry_automation_disabled' };
    manifest = validateLiquidityManifest(config.manifest);
    bond = manifest.contracts.bond;
    if (!bond || Number(env.CHAIN_ID) !== manifest.chainId
      || lower(getAddress(env.OMERTA_BOND_ADDRESS)) !== bond.address) throw new Error('expiry_domain_mismatch');
    publicClient ||= makeLiquidityKeeperClients({ ...config, manifest }, { env, signing: false }).publicClient;
  } catch {
    return { examined: 0, released: 0, held: 0, reason: 'expiry_configuration_unavailable' };
  }

  // Wall time only selects candidates. The finalized chain timestamp below establishes expiry.
  const candidates = (await pool.query(
    "SELECT q.nonce,q.deadline,q.chain_id,q.bond_address FROM bond_quotes q LEFT JOIN bonds b ON b.nonce=q.nonce WHERE q.status='quoted' AND q.deadline<$1 AND q.chain_id=$2 AND lower(q.bond_address)=$3 AND b.nonce IS NULL ORDER BY q.deadline,q.nonce LIMIT 100",
    [String(wallSeconds), manifest.chainId, bond.address],
  )).rows.slice(0, MAX_CANDIDATES);
  if (!candidates.length) return { examined: 0, released: 0, held: 0, reason: 'no_expiry_candidates' };
  const retained = (reason) => ({ examined: candidates.length, released: 0, held: candidates.length, reason });

  let proofs;
  try {
    if (Number(await publicClient.getChainId()) !== manifest.chainId) return retained('expiry_wrong_chain');
    // Never substitute latest/safe/confirmation counts when the RPC cannot provide finalized.
    const block = await publicClient.getBlock({ blockTag: 'finalized' });
    if (!block || block.number == null || !HASH.test(block.hash || '') || /^0x0+$/.test(block.hash))
      return retained('expiry_invalid_finalized_block');
    const blockNumber = uint(block.number), timestamp = uint(block.timestamp);
    if (timestamp > wallSeconds + 15n) return retained('expiry_future_finalized_block');
    const code = await publicClient.getCode({ address: getAddress(bond.address), blockNumber });
    if (!code || code === '0x' || lower(keccak256(code)) !== bond.runtimeHash) return retained('expiry_runtime_mismatch');
    const results = await Promise.all(candidates.map(async (quote) => {
      const nonce = uint(quote.nonce), deadline = uint(quote.deadline);
      if (timestamp <= deadline) return null; // bond() still accepts timestamp == deadline.
      const used = await publicClient.readContract({ address: getAddress(bond.address), abi: ABI,
        functionName: 'usedNonce', args: [nonce], blockNumber });
      if (used !== false) return null; // A used nonce may be waiting for the event watcher.
      return { schemaVersion: 1, chainId: manifest.chainId, bondAddress: bond.address,
        runtimeHash: bond.runtimeHash, finality: 'finalized', blockNumber: String(blockNumber),
        blockHash: lower(block.hash), blockTimestamp: String(timestamp), nonce: String(nonce),
        deadline: String(deadline), usedNonce: false };
    }));
    // All reads were pinned by number. Confirm that number still resolves to the same canonical block.
    const canonical = await publicClient.getBlock({ blockNumber });
    if (!canonical || canonical.number == null || uint(canonical.number) !== blockNumber
      || lower(canonical.hash) !== lower(block.hash) || uint(canonical.timestamp) !== timestamp)
      return retained('expiry_finalized_block_changed');
    proofs = results.filter(Boolean);
  } catch {
    return retained('expiry_chain_unavailable');
  }
  if (!proofs.length) return retained('no_proven_unused_expiry');

  const client = await pool.connect();
  let released = 0;
  try {
    await client.query('BEGIN');
    const budget = (await client.query('SELECT id FROM bond_reserve WHERE id=1 FOR UPDATE')).rows[0];
    if (!budget) throw new Error('bond_budget_missing');
    for (const proof of proofs) {
      const current = (await client.query('SELECT status,deadline,chain_id,bond_address FROM bond_quotes WHERE nonce=$1 FOR UPDATE', [proof.nonce])).rows[0];
      if (!current || current.status !== 'quoted' || String(current.deadline) !== proof.deadline
        || String(current.chain_id) !== String(proof.chainId) || lower(current.bond_address) !== proof.bondAddress) continue;
      if ((await client.query('SELECT 1 FROM bonds WHERE nonce=$1', [proof.nonce])).rows[0]) continue;
      // The proof and release commit together. No capacity or committed total is raised or reset.
      const updated = await client.query("UPDATE bond_quotes SET status='expired',expiry_proof=$2 WHERE nonce=$1 AND status='quoted'", [proof.nonce, JSON.stringify(proof)]);
      released += updated.rowCount;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  return { examined: candidates.length, released, held: candidates.length - released };
}
