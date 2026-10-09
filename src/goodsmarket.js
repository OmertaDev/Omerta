import { GameError } from './game.js';
import { DISTRICTS, GOODS, priceBlock } from './rules.js';

export const GOODS_MARKET = {
  STOCK_PER_BLOCK: 500,
  DEMAND_PER_BLOCK: 500,
  BLOCK_MS: 4 * 3600 * 1000,
};

const remaining = (row) => ({
  stock: Math.max(0, GOODS_MARKET.STOCK_PER_BLOCK - Number(row?.bought || 0)),
  buying: Math.max(0, GOODS_MARKET.DEMAND_PER_BLOCK - Number(row?.sold || 0)),
});

// Reads never materialize or refresh buckets. Each shop has independent supply and demand;
// selling goods back does not refill its supply, and buying goods does not refill demand.
export async function goodsLiquidityBoard(client, block = priceBlock()) {
  const rows = (await client.query(
    'SELECT good_id, district, bought, sold FROM goods_market_liquidity WHERE price_block=$1',
    [block],
  )).rows;
  const buckets = new Map(rows.map((row) => [`${row.district}:${row.good_id}`, row]));
  return {
    stockPerBlock: GOODS_MARKET.STOCK_PER_BLOCK,
    demandPerBlock: GOODS_MARKET.DEMAND_PER_BLOCK,
    refreshAt: new Date((block + 1) * GOODS_MARKET.BLOCK_MS).toISOString(),
    districts: Object.fromEntries(DISTRICTS.map((district) => [district.id,
      Object.fromEntries(GOODS.map((good) => [good.id, remaining(buckets.get(`${district.id}:${good.id}`))])),
    ])),
  };
}

// Call within the cash/cargo settlement transaction. PostgreSQL rechecks each guarded UPDATE
// after a concurrent owner of the row commits, so all characters share one bounded budget.
export async function consumeGoodsLiquidity(client, good, district, side, qty, block = priceBlock()) {
  const column = side === 'buy' ? 'bought' : side === 'sell' ? 'sold' : null;
  if (!column) throw new GameError('bad_side', 'Choose buy or sell for goods trading.');
  if (!Number.isSafeInteger(qty) || qty <= 0) throw new GameError('bad_qty', 'Choose a positive whole number of goods.');
  const assertCurrentBlock = () => {
    if (!Number.isSafeInteger(block) || block !== priceBlock()) {
      throw new GameError('price_changed', 'Goods prices refreshed. Fetch the market board and try again.',
        { available: 0, requested: qty, cooldownSeconds: 0 });
    }
  };
  assertCurrentBlock();
  const limit = side === 'buy' ? GOODS_MARKET.STOCK_PER_BLOCK : GOODS_MARKET.DEMAND_PER_BLOCK;
  const key = [good, district, block];
  // Ignore DO NOTHING's rowCount: pg-mem reports it inconsistently for existing rows.
  await client.query(
    `INSERT INTO goods_market_liquidity (good_id, district, price_block, bought, sold)
       VALUES ($1,$2,$3,0,0) ON CONFLICT (good_id, district) DO NOTHING`,
    key,
  );
  // Materialization can wait behind another transaction across a price-block boundary.
  assertCurrentBlock();
  // A delayed request from an older block cannot reset a newer block's counters.
  await client.query(
    `UPDATE goods_market_liquidity SET price_block=$3, bought=0, sold=0
       WHERE good_id=$1 AND district=$2 AND price_block<$3`,
    key,
  );
  assertCurrentBlock();
  const taken = qty <= limit ? (side === 'buy' ? await client.query(
    `UPDATE goods_market_liquidity SET bought=bought+$4
       WHERE good_id=$1 AND district=$2 AND price_block=$3 AND bought+$4<=$5
       RETURNING price_block, bought, sold`,
    [...key, qty, limit],
  ) : await client.query(
    `UPDATE goods_market_liquidity SET sold=sold+$4
       WHERE good_id=$1 AND district=$2 AND price_block=$3 AND sold+$4<=$5
       RETURNING price_block, bought, sold`,
    [...key, qty, limit],
  )).rows[0] : null;
  // A guarded update can also wait on an existing shop row; its caller rolls back an expired quote.
  assertCurrentBlock();
  if (taken) return { ...remaining(taken), priceBlock: Number(taken.price_block) };

  const row = (await client.query(
    'SELECT price_block, bought, sold FROM goods_market_liquidity WHERE good_id=$1 AND district=$2',
    [good, district],
  )).rows[0];
  const available = Math.max(0, limit - Number(row?.[column] || 0));
  if (Number(row?.price_block) > block) {
    throw new GameError('price_changed', 'Goods prices refreshed. Fetch the market board and try again.',
      { available, requested: qty, cooldownSeconds: 0 });
  }
  const cooldownSeconds = Math.max(0, Math.ceil(((block + 1) * GOODS_MARKET.BLOCK_MS - Date.now()) / 1000));
  throw new GameError(side === 'buy' ? 'goods_stock' : 'goods_demand',
    side === 'buy'
      ? `This shop has ${available} units left to sell before goods prices refresh.`
      : `This shop is buying ${available} more units before goods prices refresh.`,
    { available, requested: qty, cooldownSeconds });
}
