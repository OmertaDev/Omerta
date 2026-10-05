import { createPublicClient, http, isAddress, getAddress, encodeFunctionData, recoverTypedDataAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { GameError } from './game.js';
import { mintCharacter } from './fees.js';
import { hasPaidPortraitFee } from './portrait-access.js';
import { dynastyChainConfig, MINT_VOUCHER_TYPES, requestDynastyMint } from './chain.js';

const readAbi = (name, type) => [{ type: 'function', name, stateMutability: 'view', inputs: [], outputs: [{ type }] }];
const feeAbi = [{ type: 'function', name: 'payMintFee', stateMutability: 'payable', inputs: [], outputs: [] }];
const claimAbi = [{ type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [
  { name: 'v', type: 'tuple', components: MINT_VOUCHER_TYPES.MintVoucher }, { name: 'sig', type: 'bytes' }
], outputs: [{ type: 'uint256' }] }];

async function context(pool, accountId, client, requireWallet = true) {
  const domain = dynastyChainConfig(), fees = process.env.OMERTA_FEES_ADDRESS;
  if (domain.chainId !== 4663) throw new GameError('chain_unconfigured', 'Character checkout requires Robinhood Chain mainnet.');
  if (!process.env.CHAIN_RPC_URL || !isAddress(fees || '') || !process.env.VOUCHER_SIGNER_PK)
    throw new GameError('chain_unconfigured', 'Character checkout is unavailable.');
  let signer;
  try { signer = privateKeyToAccount(process.env.VOUCHER_SIGNER_PK.startsWith('0x')
    ? process.env.VOUCHER_SIGNER_PK : `0x${process.env.VOUCHER_SIGNER_PK}`); }
  catch { throw new GameError('chain_unconfigured', 'Character checkout signer is unavailable.'); }
  client ||= createPublicClient({ transport: http(process.env.CHAIN_RPC_URL) });
  const account = (await pool.query('SELECT minted, mint_credits, wallet_address FROM account_persistent WHERE account_id=$1', [accountId])).rows[0];
  if (requireWallet && !isAddress(account?.wallet_address || '')) throw new GameError('wallet', 'Link your wallet before checkout.');
  if (Number(await client.getChainId()) !== domain.chainId) throw new GameError('chain_unconfigured', 'Character checkout chain mismatch.');
  for (const address of [fees, domain.verifyingContract]) {
    const code = await client.getCode({ address });
    if (!code || code === '0x') throw new GameError('chain_unconfigured', 'Character checkout contract unavailable.');
  }
  const onchainSigner = await client.readContract({ address: domain.verifyingContract, abi: readAbi('signer', 'address'), functionName: 'signer' });
  if (getAddress(onchainSigner) !== signer.address) throw new GameError('chain_unconfigured', 'Character checkout signer mismatch.');
  if (await client.readContract({ address: domain.verifyingContract, abi: readAbi('paused', 'bool'), functionName: 'paused' }))
    throw new GameError('unavailable', 'Character trophy claims are paused.');
  const beat = (await pool.query('SELECT beat_at FROM worker_heartbeat WHERE id=1')).rows[0];
  const beatAge = (Date.now() - new Date(beat?.beat_at).getTime()) / 1000;
  const staleSeconds = Number(process.env.WORKER_STALE_SEC || 5400);
  if (!Number.isFinite(beatAge) || beatAge < 0 || beatAge > staleSeconds)
    throw new GameError('unavailable', 'Character confirmation worker is unavailable. No payment is offered.');
  const head = await client.getBlock();
  const cursors = (await pool.query("SELECT stream,last_block FROM chain_cursor WHERE stream IN ('fees','dynasty_minted','dynasty_transfer')")).rows;
  const maxLagSeconds = Math.min(staleSeconds, Math.max(120, Number(process.env.CHAIN_POLL_MS || 30000) * 3 / 1000));
  const headAge = Date.now() / 1000 - Number(head.timestamp);
  if (!Number.isFinite(headAge) || headAge < -30 || headAge > maxLagSeconds)
    throw new GameError('unavailable', 'Character chain observation is stale. No payment is offered.');
  if (cursors.length !== 3) throw new GameError('unavailable', 'Character confirmation tracking is not ready.');
  const confirmationDepth = Number(process.env.CHAIN_CONFIRMATIONS ?? 5);
  if (!Number.isSafeInteger(confirmationDepth) || confirmationDepth < 0 || !Number.isFinite(maxLagSeconds))
    throw new GameError('chain_unconfigured', 'Character confirmation configuration is invalid.');
  for (const cursor of cursors) {
    const blockNumber = BigInt(cursor.last_block);
    if (blockNumber <= 0n || blockNumber > head.number - BigInt(confirmationDepth))
      throw new GameError('unavailable', 'Character confirmation tracking is not ready.');
    const block = await client.getBlock({ blockNumber });
    if (head.timestamp < block.timestamp || head.timestamp - block.timestamp > BigInt(Math.floor(maxLagSeconds)))
      throw new GameError('unavailable', 'Character confirmation tracking is behind. No payment is offered.');
  }
  return { domain, fees: getAddress(fees), client, account, accountId, cursors, beatAge, from: isAddress(account?.wallet_address || '') ? getAddress(account.wallet_address) : null, signer };
}

const transaction = (ctx, to, value, data) => ({ from: ctx.from, to, value: `0x${value.toString(16)}`, data,
  accountId: ctx.accountId, chainId: ctx.domain.chainId, chainIdHex: `0x${ctx.domain.chainId.toString(16)}` });

export async function characterCheckout(pool, accountId, client, purpose = 'creation') {
  if (!['creation', 'reveal'].includes(purpose)) throw new GameError('invalid', 'Unknown character payment purpose.');
  const ctx = await context(pool, accountId, client);
  if (await hasPaidPortraitFee(pool, accountId)) throw new GameError('already', 'Your portrait fee is already confirmed. No further payment is needed.');
  const existingEntitlement = ctx.account.minted || Number(ctx.account.mint_credits) > 0;
  if (existingEntitlement && purpose !== 'reveal') throw new GameError('already', 'Your account or character credit is ready. Claim the trophy for no fee; artwork reveal is an optional separate payment.');
  if (!existingEntitlement && purpose === 'reveal') throw new GameError('invalid', 'Use character creation checkout first.');
  const fee = await ctx.client.readContract({ address: ctx.fees, abi: readAbi('mintFee', 'uint256'), functionName: 'mintFee' });
  if (fee <= 0n) throw new GameError('unavailable', 'Character creation fee is unavailable.');
  const feeRecipient = await ctx.client.readContract({ address: ctx.fees, abi: readAbi('feeRecipient', 'address'), functionName: 'feeRecipient' });
  if (await ctx.client.readContract({ address: ctx.fees, abi: readAbi('mintDevBps', 'uint256'), functionName: 'mintDevBps' }) !== 10000n)
    throw new GameError('unavailable', 'Character fee policy mismatch.');
  return { ...transaction(ctx, ctx.fees, fee, encodeFunctionData({ abi: feeAbi, functionName: 'payMintFee' })),
    action: purpose === 'reveal' ? 'optional_portrait_reveal' : 'character_fee', purpose,
    feeWei: fee.toString(), feeRecipient: getAddress(feeRecipient), confirmation: purpose === 'reveal'
      ? 'Optional artwork reveal only. Your trophy claim does not require this payment.'
      : 'Wait for the confirmed payment to appear on your account before claiming the trophy.' };
}

export async function characterReadiness(pool, accountId, client) {
  const ctx = await context(pool, accountId, client, false);
  const feeWei = await ctx.client.readContract({ address: ctx.fees, abi: readAbi('mintFee', 'uint256'), functionName: 'mintFee' });
  if (feeWei <= 0n) throw new GameError('unavailable', 'Character creation fee is unavailable.');
  const feeRecipient = await ctx.client.readContract({ address: ctx.fees, abi: readAbi('feeRecipient', 'address'), functionName: 'feeRecipient' });
  if (await ctx.client.readContract({ address: ctx.fees, abi: readAbi('mintDevBps', 'uint256'), functionName: 'mintDevBps' }) !== 10000n)
    throw new GameError('unavailable', 'Character fee policy mismatch.');
  const token = (await pool.query('SELECT token_id,owner_address FROM dynasty_tokens WHERE account_id=$1 ORDER BY created_at ASC LIMIT 1', [accountId])).rows[0];
  const nftToken = token && /^[0-9]+$/.test(String(token.token_id)) ? { tokenId: String(token.token_id),
    ownerAddress: isAddress(token.owner_address || '') ? getAddress(token.owner_address) : null,
    portraitUrl: `/v1/identity/${token.token_id}/portrait.svg` } : null;
  return { ready: true, signerMatches: true, chainId: ctx.domain.chainId, feesContract: ctx.fees,
    nftContract: ctx.domain.verifyingContract, feeWei: feeWei.toString(), feeRecipient: getAddress(feeRecipient),
    accountId, nftToken, hasPaidPortraitFee: await hasPaidPortraitFee(pool, accountId), confirmationTracking: { workerBeatAgoSeconds: Math.floor(ctx.beatAge), cursors: ctx.cursors.map((row) => ({ stream: row.stream, lastBlock: String(row.last_block) })) },
    walletLinked: !!ctx.from, characterMinted: !!ctx.account?.minted, creditReady: Number(ctx.account?.mint_credits) > 0 };
}

export async function characterClaim(pool, accountId, client, replaced = false) {
  const ctx = await context(pool, accountId, client);
  const confirmed = (await pool.query('SELECT token_id FROM dynasty_tokens WHERE account_id=$1 LIMIT 1', [accountId])).rows[0];
  if (confirmed?.token_id) throw new GameError('already', 'Your character NFT is confirmed. No further claim is needed.');
  if (!ctx.account.minted) {
    if (!(Number(ctx.account.mint_credits) > 0)) throw new GameError('not_minted', 'Wait for your character fee to be confirmed.');
    await mintCharacter(pool, accountId);
  }
  let row = (await pool.query("SELECT signed_payload FROM vouchers WHERE account_id=$1 AND kind='dynasty' AND status='signed' AND NOT claimed_onchain ORDER BY created_at DESC LIMIT 1", [accountId])).rows[0];
  if (!row) {
    await requestDynastyMint(pool, accountId);
    row = (await pool.query("SELECT signed_payload FROM vouchers WHERE account_id=$1 AND kind='dynasty' AND status='signed' AND NOT claimed_onchain ORDER BY created_at DESC LIMIT 1", [accountId])).rows[0];
  }
  const saved = JSON.parse(row?.signed_payload || '{}'), v = saved.voucher;
  if (!v || saved.domain?.name !== ctx.domain.name || saved.domain?.version !== ctx.domain.version
    || Number(saved.domain?.chainId) !== ctx.domain.chainId
    || String(saved.domain?.verifyingContract).toLowerCase() !== ctx.domain.verifyingContract.toLowerCase())
    throw new GameError('unavailable', 'This trophy voucher needs reconciliation.');
  const message = { to: getAddress(v.to), nonce: BigInt(v.nonce), deadline: BigInt(v.deadline) };
  if ((await ctx.client.getBlock()).timestamp > message.deadline) {
    // Existing authority requires confirmed expiry AND an unused nonce before
    // replacing. Never retire a voucher solely from wall-clock evidence here.
    if (replaced) throw new GameError('pending', 'Wait for confirmed expiry reconciliation before replacing this trophy voucher.');
    await requestDynastyMint(pool, accountId);
    return characterClaim(pool, accountId, client, true);
  }
  if (message.to !== ctx.from) throw new GameError('unavailable', 'This trophy voucher wallet needs reconciliation.');
  if (getAddress(await recoverTypedDataAddress({ domain: ctx.domain, types: MINT_VOUCHER_TYPES,
    primaryType: 'MintVoucher', message, signature: saved.signature })) !== ctx.signer.address)
    throw new GameError('unavailable', 'This trophy voucher signer needs reconciliation.');
  const usedAbi = [{ type: 'function', name: 'usedNonce', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'bool' }] }];
  if (await ctx.client.readContract({ address: ctx.domain.verifyingContract, abi: usedAbi, functionName: 'usedNonce', args: [message.nonce] }))
    throw new GameError('already', 'Your trophy claim is already on-chain; wait for confirmation.');
  return { ...transaction(ctx, ctx.domain.verifyingContract, 0n, encodeFunctionData({ abi: claimAbi, functionName: 'claim', args: [message, saved.signature] })), action: 'character_trophy', deadline: v.deadline };
}
