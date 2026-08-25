// THE RWA STOCK MACHINE KEEPERS.
//
// This module closes the server→chain ballot boundary. The Commission remains server-authoritative
// because family membership/standing and votes live in the game DB. Once a UTC day closes, the worker
// publishes the Safe-approved registry key chosen by that result plus a deterministic hash of the
// public tally. The on-chain buyer accepts only this day→asset-key result and resolves the token itself.
import { keccak256, toBytes } from 'viem';

const RESEND_MS = 10 * 60 * 1000;
let _publish = publishResolvedBallotOnchain;

export function __setResolvedBallotPublisher(fn) {
  _publish = fn || publishResolvedBallotOnchain;
}

export const resolvedBallotPublisherReady = () =>
  _publish !== publishResolvedBallotOnchain
  || !!(process.env.CHAIN_RPC_URL && process.env.STOCK_TOKEN_REGISTRY_ADDRESS
    && process.env.RWA_BALLOT_PUBLISHER_PK);

function canonicalTallyHash(result, votes) {
  const payload = {
    day: Number(result.day),
    result: {
      ticker: String(result.ticker).toUpperCase(),
      votes: Number(result.votes),
      weighted: Number(result.weighted),
      decidedBy: result.decided_by,
    },
    votes: votes
      .map((v) => ({ familyId: String(v.gang_id), ticker: String(v.ticker).toUpperCase(), standing: Number(v.standing) }))
      .sort((a, b) => a.familyId.localeCompare(b.familyId)),
  };
  return keccak256(toBytes(JSON.stringify(payload)));
}

/// Publish at most one unresolved result per call. Claim-then-send prevents overlapping workers from
/// submitting the same day concurrently; a failed send releases immediately, while a process crash
/// becomes retryable after the lease. The contract's one-result-per-day latch is the final idempotency
/// wall if a transaction landed but the process died before recording its hash.
export async function publishResolvedStockBallot(pool, { resendMs = RESEND_MS } = {}) {
  const row = (await pool.query(
    `SELECT day, ticker, votes, weighted, decided_by FROM ticker_ballot_results
       WHERE registry_tx_hash IS NULL ORDER BY day DESC LIMIT 1`)).rows[0];
  if (!row) return { published: false, reason: 'none' };

  const cutoff = new Date(Date.now() - resendMs);
  const claim = await pool.query(
    `UPDATE ticker_ballot_results SET registry_sent_at=now()
       WHERE day=$1 AND registry_tx_hash IS NULL
         AND (registry_sent_at IS NULL OR registry_sent_at < $2)
       RETURNING day`, [row.day, cutoff]);
  if (!claim.rowCount) return { published: false, reason: 'in_flight' };

  try {
    const asset = (await pool.query(
      'SELECT asset_key, ticker FROM stock_token_catalog WHERE ticker=$1 AND active=true',
      [String(row.ticker).toUpperCase()])).rows[0];
    if (!asset) {
      await pool.query('UPDATE ticker_ballot_results SET registry_sent_at=NULL WHERE day=$1 AND registry_tx_hash IS NULL', [row.day]);
      return { published: false, reason: 'asset_not_active', day: Number(row.day), ticker: String(row.ticker).toUpperCase() };
    }
    const votes = (await pool.query(
      'SELECT gang_id, ticker, standing FROM commission_ticker_votes WHERE day=$1 ORDER BY gang_id', [row.day])).rows;
    const tallyHash = canonicalTallyHash(row, votes);
    const payload = {
      day: Number(row.day), ticker: String(row.ticker).toUpperCase(),
      assetKey: asset.asset_key, tallyHash,
    };
    const txHash = await _publish(payload);
    await pool.query(
      'UPDATE ticker_ballot_results SET registry_tx_hash=$2 WHERE day=$1 AND registry_tx_hash IS NULL',
      [row.day, String(txHash)]);
    return { published: true, ...payload, txHash: String(txHash) };
  } catch (e) {
    await pool.query('UPDATE ticker_ballot_results SET registry_sent_at=NULL WHERE day=$1 AND registry_tx_hash IS NULL', [row.day]);
    throw e;
  }
}

async function publishResolvedBallotOnchain({ day, assetKey, tallyHash }) {
  const rpc = process.env.CHAIN_RPC_URL;
  const registryAddress = process.env.STOCK_TOKEN_REGISTRY_ADDRESS;
  const privateKey = process.env.RWA_BALLOT_PUBLISHER_PK;
  if (!rpc || !registryAddress || !privateKey) throw new Error('RWA ballot publisher unconfigured');
  const { createPublicClient, createWalletClient, getAddress, http } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const pub = createPublicClient({ transport: http(rpc) });
  const liveChainId = Number(await pub.getChainId());
  const configuredChainId = Number(process.env.CHAIN_ID || 0);
  if (configuredChainId && configuredChainId !== liveChainId)
    throw new Error('RWA ballot publisher: RPC chain does not match CHAIN_ID');
  if (liveChainId !== 4663)
    throw new Error(`RWA ballot publisher requires Robinhood Chain 4663; RPC is ${liveChainId}`);

  const address = getAddress(registryAddress);
  const readAbi = [{ type: 'function', name: 'ballots', stateMutability: 'view',
    inputs: [{ name: 'day', type: 'uint256' }], outputs: [
      { name: 'assetKey', type: 'bytes32' }, { name: 'tallyHash', type: 'bytes32' },
      { name: 'publishedAt', type: 'uint64' },
    ] }];
  const existing = await pub.readContract({ address, abi: readAbi, functionName: 'ballots', args: [BigInt(day)] });
  if (Number(existing[2]) > 0) {
    if (String(existing[0]).toLowerCase() !== String(assetKey).toLowerCase()
      || String(existing[1]).toLowerCase() !== String(tallyHash).toLowerCase()) {
      throw new Error(`RWA ballot ${day} is already published with a different result`);
    }
    return `onchain:already:${day}`;
  }

  const chain = { id: liveChainId, name: 'Robinhood Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpc] } } };
  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });
  const writeAbi = [{ type: 'function', name: 'publishBallot', stateMutability: 'nonpayable',
    inputs: [{ name: 'day', type: 'uint256' }, { name: 'assetKey', type: 'bytes32' },
      { name: 'tallyHash', type: 'bytes32' }], outputs: [] }];
  const hash = await wallet.writeContract({ address, abi: writeAbi, functionName: 'publishBallot',
    args: [BigInt(day), assetKey, tallyHash] });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`RWA ballot publish reverted: ${hash}`);
  return hash;
}
