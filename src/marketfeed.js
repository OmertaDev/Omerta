import crypto from 'node:crypto';
import { GameError } from './game.js';
import { DISTRICTS, priceBlock } from './rules.js';
import { GOODS_MARKET } from './goodsmarket.js';
import { marketPrices } from './streets.js';
import { canonicalBytes } from './content/canonical.js';

const fail = () => { throw new GameError('market_feed', 'Choose one public district and gin; no other feed filters are supported.'); };
const integer = (n, min, max) => { if (!Number.isSafeInteger(n) || n < min || n > max) fail(); return n; };

// An informational public snapshot, never an executable quote or proof of funds.
// observedAt is the server capture start; the read may finish after a rollover.
// Runtime callers supply only client/query. Providers exist for bounded tests.
export async function publicMarketFeed(client, query, { now = Date.now, snapshot = marketPrices } = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query)
    || Object.keys(query).sort().join(',') !== 'districtId,goodId'
    || !DISTRICTS.some(district => district.id === query.districtId) || query.goodId !== 'gin') fail();
  const capturedAt = integer(now(), 0, 8640000000000000 - GOODS_MARKET.BLOCK_MS);
  const block = priceBlock(capturedAt);
  const board = await snapshot(client, block);
  const bucket = board?.liquidity?.districts?.[query.districtId]?.gin;
  const refreshAt = new Date((block + 1) * GOODS_MARKET.BLOCK_MS).toISOString();
  if (board?.block !== block || board?.liquidity?.refreshAt !== refreshAt) fail();
  const result = {
    schema: 'omerta.public-market-feed.v1', source: '/v1/market/prices',
    observedAt: new Date(capturedAt).toISOString(), priceBlock: block, refreshAt,
    scope: { districtId: query.districtId, goodId: 'gin' },
    data: {
      unitPrice: integer(board?.goods?.[query.districtId]?.gin, 1, Number.MAX_SAFE_INTEGER),
      availableStock: integer(bucket?.stock, 0, GOODS_MARKET.STOCK_PER_BLOCK),
      buyingDemand: integer(bucket?.buying, 0, GOODS_MARKET.DEMAND_PER_BLOCK),
    },
    paymentRequired: false, financialActivation: false,
  };
  return { ...result, sourceHash: crypto.createHash('sha256').update(canonicalBytes(result)).digest('hex') };
}
