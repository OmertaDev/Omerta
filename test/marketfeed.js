import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { publicMarketFeed } from '../src/marketfeed.js';
import { marketPrices } from '../src/streets.js';
import { DISTRICTS, priceBlock } from '../src/rules.js';
import { GOODS_MARKET } from '../src/goodsmarket.js';
import { canonicalBytes } from '../src/content/canonical.js';

const db = newDb();
db.public.none('CREATE TABLE goods_market_liquidity(good_id TEXT,district TEXT,price_block BIGINT,bought INTEGER,sold INTEGER)');
const { Pool } = db.adapters.createPg();
const pool = new Pool();
const start = 1760000000000, block = priceBlock(start);
await pool.query('INSERT INTO goods_market_liquidity VALUES($1,$2,$3,$4,$5)', ['gin','docks',block,17,9]);
const queries = [];
const readOnly = { query: async (sql, args) => {
  assert(/^SELECT\s/.test(sql), 'Public source read never mutates or creates market buckets');
  queries.push({ sql, args });
  return pool.query(sql, args);
} };
try {
  for (const district of DISTRICTS) {
    const board = await marketPrices(readOnly, block);
    const feed = await publicMarketFeed(readOnly, { districtId: district.id, goodId: 'gin' }, { now: () => start });
    assert.deepEqual(feed.data, { unitPrice: board.goods[district.id].gin,
      availableStock: board.liquidity.districts[district.id].gin.stock,
      buyingDemand: board.liquidity.districts[district.id].gin.buying });
    const { sourceHash, ...digestInput } = feed;
    assert.equal(sourceHash, crypto.createHash('sha256').update(canonicalBytes(digestInput)).digest('hex'));
    assert.deepEqual(feed, await publicMarketFeed(readOnly, { goodId: 'gin', districtId: district.id }, { now: () => start }));
    assert.deepEqual(Object.keys(feed).sort(), ['data','financialActivation','observedAt','paymentRequired','priceBlock','refreshAt','schema','scope','source','sourceHash'].sort());
    assert.equal(feed.paymentRequired, false); assert.equal(feed.financialActivation, false);
  }
  const query = { districtId: 'docks', goodId: 'gin' };
  for (const bad of [null, [], {}, { ...query, block }, { ...query, observedAt: start },
    { ...query, accountId: 'private' }, { ...query, districtId: ['docks'] },
    { ...query, districtId: 'unknown' }, { ...query, goodId: 'private' }]) {
    const before = queries.length;
    await assert.rejects(publicMarketFeed(readOnly, bad), { code: 'market_feed' });
    assert.equal(queries.length, before, 'Rejected filters never reach a source query');
  }
  const rollover = (block + 1) * GOODS_MARKET.BLOCK_MS;
  let clockCalls = 0, seenBlock, clockTime = rollover - 1;
  const crossing = await publicMarketFeed(readOnly, query, {
    now: () => { clockCalls++; return clockTime; },
    snapshot: async (client, capturedBlock) => {
      seenBlock = capturedBlock;
      clockTime = rollover;
      const board = await marketPrices(client, capturedBlock);
      board.privateBuyerHistory = ['secret'];
      board.goods.docks.private = 999;
      return board;
    },
  });
  assert.equal(clockCalls, 1); assert.equal(seenBlock, block);
  assert.equal(crossing.observedAt, new Date(rollover - 1).toISOString());
  assert.equal(crossing.refreshAt, new Date(rollover).toISOString());
  assert(!JSON.stringify(crossing).includes('secret'));
  assert(!JSON.stringify(crossing).includes('private'));
  const after = await publicMarketFeed(readOnly, query, { now: () => rollover });
  assert.equal(after.priceBlock, block + 1); assert.equal(after.data.availableStock, 500);
  assert.notEqual(after.sourceHash, crossing.sourceHash);
  for (const now of [() => NaN, () => -1, () => Infinity, () => 1.5])
    await assert.rejects(publicMarketFeed(readOnly, query, { now }), { code: 'market_feed' });
  const canonical = await marketPrices(readOnly, block);
  for (const changed of [{ ...canonical, block: block + 1 },
    { ...canonical, goods: { docks: { gin: Infinity } } },
    { ...canonical, liquidity: { ...canonical.liquidity, refreshAt: new Date(rollover + 1).toISOString() } },
    { ...canonical, liquidity: { ...canonical.liquidity, districts: { docks: { gin: { stock: 501, buying: 500 } } } } }])
    await assert.rejects(publicMarketFeed(readOnly, query, { now: () => start, snapshot: async () => changed }), { code: 'market_feed' });
  assert.deepEqual((await pool.query('SELECT bought,sold FROM goods_market_liquidity')).rows, [{ bought: 17, sold: 9 }]);
  console.log('public market feed tests passed: canonical parity, bounded privacy, digest and captured-block rollover');
} finally { await pool.end(); }
