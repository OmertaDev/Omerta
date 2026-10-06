import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createPublicClient, defineChain, getAddress, http } from 'viem';
import { GenesisAuctionError, readGenesisAuction, prepareGenesisAuctionTransaction } from '../genesisauction.js';

export function loadGenesisAuctionManifest(env = process.env) {
  const file = env === process.env ? process.env.GENESIS_AUCTION_MANIFEST_PATH : env.GENESIS_AUCTION_MANIFEST_PATH;
  const expected = env === process.env ? process.env.GENESIS_AUCTION_MANIFEST_SHA256 : env.GENESIS_AUCTION_MANIFEST_SHA256;
  if (!file && !expected) return null;
  if (!file || !/^[a-f0-9]{64}$/i.test(expected || '')) throw Error('Genesis manifest pin is incomplete.');
  const stat = statSync(file);
  if (!stat.isFile() || stat.size > 1_048_576) throw Error('Genesis manifest must be a bounded regular file.');
  const bytes = readFileSync(file);
  if (createHash('sha256').update(bytes).digest('hex') !== expected.toLowerCase()) throw Error('Genesis manifest pin differs.');
  return JSON.parse(bytes.toString('utf8'));
}

export function register(app, { auth, env = process.env, client = null, manifest = undefined } = {}) {
  const pinned = manifest === undefined ? loadGenesisAuctionManifest(env) : manifest;
  const publicClient = client || (pinned && createPublicClient({
    chain: defineChain({ id: 4663, name: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [env.CHAIN_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com/'] } } }),
    transport: http(env.CHAIN_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com/', { timeout: 12_000, retryCount: 0 }),
  }));
  const options = auth ? { preHandler: auth } : {};
  const unavailable = reply => reply.code(503).send({ error: 'genesis_not_ready',
    message: 'The genesis auction is awaiting verified deployment and funding. Payments are unavailable.' });

  app.get('/v1/genesis-auction', options, async (req, reply) => {
    reply.header('cache-control', 'no-store');
    if (!pinned) return unavailable(reply);
    let account;
    try { account = getAddress(req.query?.account); } catch { return reply.code(400).send({ error: 'invalid_account' }); }
    try { return await readGenesisAuction({ manifest: pinned, account, client: publicClient, bidId: req.query?.bidId }); }
    catch { return reply.code(503).send({ error: 'genesis_verification_failed',
      message: 'Live auction state could not be verified. No payment has been prepared.' }); }
  });

  app.post('/v1/genesis-auction/tx', options, async (req, reply) => {
    reply.header('cache-control', 'no-store');
    if (!pinned) return unavailable(reply);
    const body = req.body || {};
    if (Object.keys(body).some(k => !['account', 'action', 'amountEth', 'maxPriceX96', 'bidId', 'lastFullyFilledCheckpointBlock', 'outbidBlock'].includes(k))) {
      return reply.code(400).send({ error: 'invalid_genesis_input' });
    }
    let account;
    try { account = getAddress(body.account); } catch { return reply.code(400).send({ error: 'invalid_account' }); }
    try {
      return await prepareGenesisAuctionTransaction({ manifest: pinned, client: publicClient, account,
        action: body.action, amountEth: body.amountEth, maxPriceX96: body.maxPriceX96, bidId: body.bidId,
        lastFullyFilledCheckpointBlock: body.lastFullyFilledCheckpointBlock, outbidBlock: body.outbidBlock });
    } catch (error) {
      if (error instanceof GenesisAuctionError && ['nft_required', 'ineligible', 'wrong_phase', 'invalid_input',
        'bid_owner', 'simulation_failed', 'exit_hints_required'].includes(error.code)) {
        return reply.code(409).send({ error: error.code, message: error.message });
      }
      return reply.code(409).send({ error: 'genesis_action_blocked',
        message: 'This transaction is unavailable or would fail. Refresh the auction and check your inputs.' });
    }
  });
}
