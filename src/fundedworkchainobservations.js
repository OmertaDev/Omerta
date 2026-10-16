import crypto from 'node:crypto';

// Read-only source observation, never a deposit, encumbrance, allocation or recovery authority.
// Circle issuer identity verified 2026-10-13 from its official contract-address documentation.
export const ETHEREUM_USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const FUNDED_WORK_ADAPTER_STATUS = Object.freeze({ financialActivation: false, available: false,
  reason: 'work_escrow_encumbrance_and_recovery_unavailable', chainObservation: 'read_only_internal',
  HOOD: 'canonical_stock_token_identity_unverified', workBackingVerified: false });
// This public boundary deliberately does not inspect provider/options/body, including getters.
export function publicFundedWorkBacking() { return FUNDED_WORK_ADAPTER_STATUS; }
const fail = reason => { const e = new Error(reason); e.code = 'funded_work_observation'; throw e; };
const address = v => typeof v === 'string' && /^0x[0-9a-f]{40}$/.test(v) && v !== '0x' + '0'.repeat(40);
const hash = v => typeof v === 'string' && /^0x[0-9a-f]{64}$/.test(v) && v !== '0x' + '0'.repeat(64);
const quantity = v => { if (typeof v !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(v) || v.length > 66) fail('rpc_quantity'); return BigInt(v); };
const identity = v => { if (typeof v !== 'string') fail('rpc_identity'); return v.toLowerCase(); };
const same = (a, b, reason) => { if (a !== b) fail(reason); };
const head = block => { if (!block || !hash(identity(block.hash)) || quantity(block.number) === 0n) fail('block'); return { number: block.number, hash: identity(block.hash) }; };
const eventAddress = topic => { if (typeof topic !== 'string' || !/^0x0{24}[0-9a-f]{40}$/.test(topic)) fail('transfer_topic'); return '0x' + topic.slice(-40); };
export async function observeFinalizedWorkTransfer(client, body) {
  if (!body || Object.keys(body).sort().join(',') !== 'amountAtoms,asset,chainId,from,logIndex,to,transactionHash') fail('terms');
  // Closed current source slice. HOOD, bridged USDC, WETH and testnet representations refuse.
  if (body.chainId !== '1' || !['ETH', 'USDC'].includes(body.asset)) fail('asset_unavailable');
  if (!address(body.from) || !address(body.to) || body.from === body.to || !hash(body.transactionHash)) fail('identity');
  if (typeof body.amountAtoms !== 'string' || !/^[1-9][0-9]{0,77}$/.test(body.amountAtoms) || BigInt(body.amountAtoms) >= 2n ** 256n) fail('amount');
  if (body.asset === 'ETH' ? body.logIndex !== null : !Number.isSafeInteger(body.logIndex) || body.logIndex < 0 || body.logIndex > 100000) fail('log_index');
  if (!client || typeof client.request !== 'function') fail('reader');
  const rpc = (method, params) => client.request({ method, params });
  same(await rpc('eth_chainId', []), '0x1', 'chain');
  const receipt = await rpc('eth_getTransactionReceipt', [body.transactionHash]);
  if (!receipt || !Array.isArray(receipt.logs) || receipt.logs.length > 256) fail('receipt');
  same(identity(receipt.transactionHash), body.transactionHash, 'transaction'); same(receipt.status, '0x1', 'reverted');
  const source = head({ number: receipt.blockNumber, hash: receipt.blockHash }), finalized = head(await rpc('eth_getBlockByNumber', ['finalized', false]));
  if (quantity(source.number) > quantity(finalized.number)) fail('unfinalized');
  const block = head(await rpc('eth_getBlockByNumber', [source.number, false]));
  same(block.hash, source.hash, 'reorg'); same(block.number, source.number, 'block');
  let tokenAddress = null, tokenCode = null;
  if (body.asset === 'ETH') {
    const tx = await rpc('eth_getTransactionByHash', [body.transactionHash]);
    if (!tx) fail('transaction'); same(identity(tx.hash), body.transactionHash, 'transaction');
    same(identity(tx.from), body.from, 'sender'); same(identity(tx.to), body.to, 'recipient');
    same(identity(tx.blockHash), source.hash, 'reorg'); same(tx.blockNumber, source.number, 'block');
    same(quantity(tx.value).toString(), body.amountAtoms, 'amount');
    same(identity(receipt.from), body.from, 'sender'); same(identity(receipt.to), body.to, 'recipient');
  } else {
    tokenAddress = ETHEREUM_USDC;
    const matches = receipt.logs.filter(log => quantity(log.logIndex) === BigInt(body.logIndex));
    if (matches.length !== 1) fail('duplicate_log'); const log = matches[0];
    if (log.removed !== false || !Array.isArray(log.topics) || log.topics.length !== 3) fail('log');
    same(identity(log.address), tokenAddress, 'canonical_token'); same(identity(log.transactionHash), body.transactionHash, 'transaction');
    same(identity(log.blockHash), source.hash, 'reorg'); same(log.blockNumber, source.number, 'block');
    same(identity(log.topics[0]), TRANSFER, 'transfer_event');
    same(eventAddress(identity(log.topics[1])), body.from, 'sender'); same(eventAddress(identity(log.topics[2])), body.to, 'recipient');
    if (typeof log.data !== 'string' || !/^0x[0-9a-f]{64}$/.test(log.data)) fail('transfer_data');
    same(BigInt(log.data).toString(), body.amountAtoms, 'amount');
    const at = { blockHash: source.hash, requireCanonical: true };
    tokenCode = await rpc('eth_getCode', [tokenAddress, at]);
    if (typeof tokenCode !== 'string' || !/^0x(?:[0-9a-f]{2}){1,24576}$/.test(tokenCode)) fail('token_code');
    const decimals = await rpc('eth_call', [{ to: tokenAddress, data: '0x313ce567' }, at]);
    if (typeof decimals !== 'string' || !/^0x[0-9a-f]{64}$/.test(decimals) || BigInt(decimals) !== 6n) fail('decimals');
  }
  const reread = head(await rpc('eth_getBlockByNumber', [source.number, false]));
  same(reread.hash, source.hash, 'reorg'); same(reread.number, source.number, 'block');
  same(await rpc('eth_chainId', []), '0x1', 'chain');
  const observation = { kind: 'finalized_rpc_transfer_observation', chainId: '1', asset: body.asset,
    tokenAddress, decimals: body.asset === 'ETH' ? 18 : 6, from: body.from, to: body.to, amountAtoms: body.amountAtoms,
    transactionHash: body.transactionHash, logIndex: body.logIndex, blockNumber: quantity(source.number).toString(),
    blockHash: source.hash, finalizedBlockNumber: quantity(finalized.number).toString(), finalizedBlockHash: finalized.hash,
    tokenRuntimeSha256: tokenCode ? crypto.createHash('sha256').update(Buffer.from(tokenCode.slice(2), 'hex')).digest('hex') : null,
    trust: 'configured_rpc_observation_not_consensus_proof', encumbranceVerified: false, workBackingVerified: false,
    originalAccountConsentVerified: false, allocationVerified: false, recoveryVerified: false };
  return Object.freeze({ ...observation, observationHash: crypto.createHash('sha256').update(JSON.stringify(observation)).digest('hex') });
}
