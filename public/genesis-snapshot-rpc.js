// Genesis reads use the exact observed canonical header, never a latest fallback.
const HASH = /^0x[0-9a-fA-F]{64}$/;
const QUANTITY = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const STATE = new Set(['eth_call', 'eth_getCode', 'eth_getBalance', 'eth_getTransactionCount']);
const U256 = (1n << 256n) - 1n;
const numberKey = value => typeof value === 'bigint' && value >= 0n && value <= U256 ? value.toString()
  : typeof value === 'string' && value.length <= 66 && QUANTITY.test(value) ? BigInt(value).toString() : null;
export function genesisSnapshotRequest(request, { maximumHeaders = 256 } = {}) {
  if (typeof request !== 'function' || !Number.isSafeInteger(maximumHeaders) || maximumHeaders < 1 || maximumHeaders > 256)
    throw Error('Invalid genesis snapshot RPC configuration.');
  const headers = new Map(); let chain;
  return async (args, ...options) => {
    let forwarded = args;
    if (STATE.has(args.method)) {
      const selector = args.params?.[1], key = numberKey(selector);
      if (key !== null) {
        const hash = headers.get(key);
        if (!hash) throw Error('Genesis snapshot header is unknown; no unpinned read was requested.');
        forwarded = { ...args, params: [args.params[0], { blockHash: hash, requireCanonical: true }, ...args.params.slice(2)] };
      } else if (selector && typeof selector === 'object') {
        if (!HASH.test(selector.blockHash || '') || selector.requireCanonical !== true
          || Object.keys(selector).sort().join(',') !== 'blockHash,requireCanonical'
          || ![...headers.values()].includes(selector.blockHash.toLowerCase()))
          throw Error('Genesis snapshot hash is unknown or noncanonical.');
      } else if (!['eth_getBalance', 'eth_getTransactionCount'].includes(args.method)
        || !['latest', 'pending'].includes(selector)) {
        throw Error('Genesis contract reads require an observed canonical snapshot.');
      }
    }
    // Unsupported hash selectors propagate; retrying with latest/numeric would loosen the pin.
    const result = await request(forwarded, ...options);
    if (args.method === 'eth_chainId') {
      if (chain !== undefined && chain !== result) { headers.clear(); chain = result; throw Error('Genesis RPC chain changed.'); }
      chain = result;
    }
    if (args.method === 'eth_getBlockByNumber') {
      const key = numberKey(result?.number), requested = numberKey(args.params?.[0]);
      if (key === null || !HASH.test(result?.hash || '') || (requested !== null && key !== requested))
        throw Error('Genesis snapshot header is unavailable or has the wrong number.');
      const hash = result.hash.toLowerCase(), prior = headers.get(key);
      if (prior && prior !== hash) throw Error('Genesis canonical snapshot changed (block hash differs).');
      if (!prior) {
        headers.set(key, hash);
        if (headers.size > maximumHeaders) headers.delete(headers.keys().next().value);
      }
    }
    return result;
  };
}
