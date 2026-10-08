import { createHash } from 'node:crypto';

const MAX_USD_MICROS = 1_000_000_000_000;

function identifier(value, name) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new TypeError(`${name} must be a bounded identifier`);
  }
  return value;
}

function integer(value, name, max) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RangeError(`${name} must be an integer between 1 and ${max}`);
  }
  return value;
}

// Explicit version/domain and a canonical tuple prevent cross-round/account reuse.
// The caller must generate and privately retain a cryptographically random nonce.
export function computeBidCommitment({ roundId, accountId, bidUsdMicros, nonce }) {
  identifier(roundId, 'roundId');
  identifier(accountId, 'accountId');
  integer(bidUsdMicros, 'bidUsdMicros', MAX_USD_MICROS);
  if (typeof nonce !== 'string' || !/^[a-fA-F0-9]{32,128}$/.test(nonce)) {
    throw new TypeError('nonce must contain 32 to 128 hexadecimal characters');
  }
  return createHash('sha256').update(JSON.stringify([
    'omerta:compute-auction:bid:v1', roundId, accountId, bidUsdMicros, nonce.toLowerCase(),
  ])).digest('hex');
}

// Uniform price is the lowest accepted bid when capacity is oversubscribed;
// otherwise it is the reserve. Settlement and refunds belong to the caller.
export function clearComputeAuction({ capacity, reserveUsdMicros, bids }) {
  integer(capacity, 'capacity', 100);
  integer(reserveUsdMicros, 'reserveUsdMicros', MAX_USD_MICROS);
  if (!Array.isArray(bids) || bids.length > 1000) {
    throw new RangeError('bids must be an array of at most 1000 entries');
  }
  const accounts = new Set();
  const ids = new Set();
  const checked = bids.map(bid => {
    if (!bid || typeof bid !== 'object') throw new TypeError('invalid bid');
    const accountId = identifier(bid.accountId, 'accountId');
    const bidId = identifier(bid.bidId, 'bidId');
    const bidUsdMicros = integer(bid.bidUsdMicros, 'bidUsdMicros', MAX_USD_MICROS);
    if (accounts.has(accountId) || ids.has(bidId)) throw new TypeError('duplicate account or bid');
    accounts.add(accountId);
    ids.add(bidId);
    return { accountId, bidId, bidUsdMicros };
  });
  const qualifying = checked.filter(bid => bid.bidUsdMicros >= reserveUsdMicros)
    .sort((a, b) => b.bidUsdMicros - a.bidUsdMicros || (a.bidId < b.bidId ? -1 : a.bidId > b.bidId ? 1 : 0));
  const accepted = qualifying.slice(0, capacity);
  const clearingUsdMicros = qualifying.length > capacity
    ? accepted[accepted.length - 1].bidUsdMicros : reserveUsdMicros;
  const winnerIds = new Set(accepted.map(bid => bid.bidId));
  return {
    clearingUsdMicros,
    winners: accepted.map(({ accountId, bidId }) => ({ accountId, bidId, priceUsdMicros: clearingUsdMicros })),
    losers: checked.filter(bid => !winnerIds.has(bid.bidId)).map(bid => bid.bidId).sort(),
  };
}
