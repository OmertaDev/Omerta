import assert from 'node:assert/strict';
import { decodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { characterCheckout, characterClaim, characterReadiness } from '../src/identity-checkout.js';
import { MINT_VOUCHER_TYPES } from '../src/chain.js';

const original = { ...process.env };
const realNow = Date.now;
Date.now = () => 1000000;
const signer = privateKeyToAccount(`0x${'11'.repeat(32)}`), wallet = `0x${'22'.repeat(20)}`;
const fees = `0x${'33'.repeat(20)}`, nft = `0x${'44'.repeat(20)}`;
Object.assign(process.env, { VOUCHER_SIGNER_PK: `0x${'11'.repeat(32)}`,
  CHAIN_RPC_URL: 'http://127.0.0.1:1', CHAIN_ID: '4663', OMERTA_FEES_ADDRESS: fees, DYNASTY_NFT_ADDRESS: nft });
let minted = false, credits = 0, linked = wallet, used = false, paused = false, actualSigner = signer.address, chain = 4663, fee = 10000000000000000n;
const domain = { name: 'OmertaDynasty', version: '1', chainId: 4663, verifyingContract: nft };
const voucher = { to: wallet, nonce: '7', deadline: '2000' };
const signature = await signer.signTypedData({ domain, types: MINT_VOUCHER_TYPES, primaryType: 'MintVoucher',
  message: { to: wallet, nonce: 7n, deadline: 2000n } });
let saved = { domain, voucher, signature };
let beat = new Date(Date.now()), cursorTime = 1000n, tracking = true, headTime = 1000n, paid = false, token = null;
const pool = { query: async (sql) => ({ rows: sql.includes('account_persistent')
  ? [{ minted, mint_credits: credits, wallet_address: linked }]
  : sql.includes('worker_heartbeat') ? [{ beat_at: beat }]
    : sql.includes('dynasty_tokens') ? (token ? [token] : [])
    : sql.includes('fee_payments') ? (paid ? [{ amount_wei: '3', tx_hash: `0x${'99'.repeat(32)}` }] : [])
    : sql.includes('chain_cursor') ? (tracking ? ['fees', 'dynasty_minted', 'dynasty_transfer'].map((stream) => ({ stream, last_block: '95' })) : [])
      : [{ signed_payload: JSON.stringify(saved) }] }) };
const client = { getChainId: async () => chain, getCode: async () => '0x6000', getBlock: async (args) => ({ number: 100n, timestamp: args ? cursorTime : headTime }),
  readContract: async ({ functionName }) => ({ signer: actualSigner, paused, mintFee: fee, feeRecipient: wallet, mintDevBps: 10000n, usedNonce: used })[functionName] };
try {
  const checkout = await characterCheckout(pool, 'actor', client);
  await assert.rejects(() => characterCheckout(pool, 'actor', client, 'unknown'), { code: 'invalid' });
  await assert.rejects(() => characterCheckout(pool, 'actor', client, 'reveal'), { code: 'invalid' });
  assert.equal(checkout.from.toLowerCase(), wallet); assert.equal(checkout.to.toLowerCase(), fees);
  assert.equal(checkout.feeWei, '10000000000000000'); assert.equal(checkout.value, '0x2386f26fc10000');
  assert.equal(decodeFunctionData({ abi: [{ type: 'function', name: 'payMintFee', inputs: [], outputs: [], stateMutability: 'payable' }], data: checkout.data }).functionName, 'payMintFee');
  fee = 3n; assert.equal((await characterCheckout(pool, 'actor', client)).value, '0x3');
  fee = 0n; await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'unavailable' }); fee = 3n;
  tracking = false; await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'unavailable' }); tracking = true;
  cursorTime = 800n; await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'unavailable' }); cursorTime = 1000n;
  beat = new Date(Date.now() - 6000000); await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'unavailable' }); beat = new Date(Date.now());
  headTime = 800n; await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'unavailable' }); headTime = 1000n;
  headTime = 1100n; await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'unavailable' }); headTime = 1000n;
  chain = 1; await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'chain_unconfigured' }); chain = 4663;
  chain = 1; process.env.CHAIN_ID = '1'; await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'chain_unconfigured' }); chain = 4663; process.env.CHAIN_ID = '4663';
  actualSigner = wallet; await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'chain_unconfigured' }); actualSigner = signer.address;
  paused = true; await assert.rejects(() => characterReadiness(pool, 'actor', client), { code: 'unavailable' }); paused = false;
  linked = null; await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'wallet' });
  assert.equal((await characterReadiness(pool, 'actor', client)).walletLinked, false); linked = wallet;
  credits = 1; await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'already' }); credits = 0;
  await assert.rejects(() => characterClaim(pool, 'actor', client), { code: 'not_minted' });
  minted = true; await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'already' });
  assert.equal((await characterCheckout(pool, 'actor', client, 'reveal')).action, 'optional_portrait_reveal');
  paid = true;
  await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'already' });
  await assert.rejects(() => characterCheckout(pool, 'actor', client, 'reveal'), { code: 'already' });
  assert.equal((await characterReadiness(pool, 'actor', client)).hasPaidPortraitFee, true); paid = false;
  const claim = await characterClaim(pool, 'actor', client);
  assert.equal(claim.value, '0x0'); assert.equal(claim.to.toLowerCase(), nft);
  const abi = [{ type: 'function', name: 'claim', inputs: [{ type: 'tuple', components: MINT_VOUCHER_TYPES.MintVoucher }, { type: 'bytes' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' }];
  const decoded = decodeFunctionData({ abi, data: claim.data });
  assert.equal(decoded.functionName, 'claim'); assert.equal(decoded.args[0].nonce, 7n); assert.equal(decoded.args[1], signature);
  used = true; await assert.rejects(() => characterClaim(pool, 'actor', client), { code: 'already' }); used = false;
  token = { token_id: '42', owner_address: wallet };
  assert.equal((await characterReadiness(pool, 'actor', client)).nftToken.tokenId, '42');
  await assert.rejects(() => characterClaim(pool, 'actor', client), { code: 'already' });
  paid = true; await assert.rejects(() => characterCheckout(pool, 'actor', client, 'reveal'), { code: 'already' }); paid = false;
  assert.equal((await characterCheckout(pool, 'actor', client, 'reveal')).purpose, 'reveal', 'An unpaid confirmed trophy may explicitly reveal artwork'); token = null;
  saved = { ...saved, domain: { ...domain, chainId: 1 } }; await assert.rejects(() => characterClaim(pool, 'actor', client), { code: 'unavailable' });
  saved = { domain, voucher: { ...voucher, to: fees }, signature }; await assert.rejects(() => characterClaim(pool, 'actor', client), { code: 'unavailable' });
  delete process.env.VOUCHER_SIGNER_PK; await assert.rejects(() => characterCheckout(pool, 'actor', client), { code: 'chain_unconfigured' });
  console.log('identity checkout: live fee, ABI, bound wallet/domain, signer/chain/pause failclosed, no duplicate fee, confirmed-credit gate and nonce checks PASS');
} finally {
  Date.now = realNow;
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
}
