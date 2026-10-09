// NPC goods liquidity is shared and finite: a profitable freight run must not become
// an unlimited cash faucet by repeating the same four requests inside one price block.
import assert from 'node:assert/strict';

process.env.DATABASE_URL = '';
process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'goods-market-test-secret';
process.env.MARKET_SEED = 'omerta-server-seed';
process.env.SEASON_MOD = 'dead_quiet';
process.env.STAT_USE_P = '0';
const realNow = Date.now;
let now = Date.parse('2026-10-09T10:13:00Z');
Date.now = () => now;

const { buildServer } = await import('../src/server.js');
const { priceBlock, CONSTANTS } = await import('../src/rules.js');
const { consumeGoodsLiquidity, goodsLiquidityBoard } = await import('../src/goodsmarket.js');
const app = await buildServer();
const pool = app.pool;
const block = priceBlock();
const good = 'bearer', source = 'docks', destination = 'foundry';
const wheels = ['beater', 'muscle71', 'hearse', 'tourista', 'super', 'tanker'];

const call = async (method, url, token, body) => {
  const res = await app.inject({ method, url, payload: body,
    headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { code: res.statusCode, body: res.json() };
};
const ok = async (method, url, token, body) => {
  const res = await call(method, url, token, body);
  assert.equal(res.code, 200, `${method} ${url}: ${JSON.stringify(res.body)}`);
  return res.body;
};
const create = async (name) => {
  const { token } = await ok('POST', '/v1/auth/guest');
  await ok('POST', '/v1/character', token, { name });
  const me = (await ok('GET', '/v1/me', token)).character;
  await pool.query('UPDATE characters SET cash=5000000, loc=$2 WHERE id=$1', [me.id, source]);
  for (const asset of wheels) {
    await pool.query('INSERT INTO character_assets (character_id, asset_id) VALUES ($1,$2)', [me.id, asset]);
  }
  assert.equal((await ok('GET', '/v1/me', token)).character.cargoCap, 430);
  return { token, id: me.id };
};
const stateOf = async (player) => {
  const { cash } = (await pool.query('SELECT cash FROM characters WHERE id=$1', [player.id])).rows[0];
  const cargo = (await pool.query(
    'SELECT good_id, qty FROM character_cargo WHERE character_id=$1 ORDER BY good_id', [player.id])).rows;
  return { cash: Number(cash), cargo: cargo.map((r) => ({ good: r.good_id, qty: Number(r.qty) })) };
};
const liquidity = async (district, id = good) =>
  (await goodsLiquidityBoard(pool)).districts[district][id];
const rejectedTrade = async (player, side, qty, error, available) => {
  const before = await stateOf(player);
  const res = await call('POST', `/v1/goods/${side}`, player.token, { goodId: good, qty });
  assert.equal(res.code, 400, JSON.stringify(res.body));
  assert.equal(res.body.error, error);
  assert.equal(res.body.available, available);
  assert.equal(res.body.requested, qty);
  assert.equal(res.body.cooldownSeconds, Math.ceil(((block + 1) * 4 * 3600 * 1000 - now) / 1000));
  assert.deepEqual(await stateOf(player), before, 'rejected trade preserves cash and cargo');
};
const sizedPlans = (turn) => {
  const plans = turn.plans.filter((p) => p.kind === 'arbitrage');
  assert(plans.length > 0, 'available trading routes still produce arbitrage plans');
  for (const plan of plans) {
    const edge = turn.opportunities.niches.arbitrage.find((e) =>
      plan.id === `arbitrage:${e.good}:${e.buyIn}:${e.sellIn}`);
    assert(edge, 'arbitrage plan corresponds to a current opportunity');
    assert(plan.quantity <= Math.min(edge.stock, edge.buying), 'empty-trunk procurement fits live stock and demand');
    const action = turn.actions.find((a) => a.id === plan.nextActionId);
    if (action?.kind === 'arbitrage_buy') assert.equal(action.body.qty, plan.quantity);
  }
  return plans;
};

try {
  const first = await create('Finite Freight');
  const second = await create('Shared Freight');
  const board = (await ok('GET', '/v1/market/prices')).liquidity;
  assert.equal(board.stockPerBlock, 500);
  assert.equal(board.demandPerBlock, 500);
  assert.equal(board.refreshAt, new Date((block + 1) * 4 * 3600 * 1000).toISOString());
  assert.deepEqual(board.districts[source][good], { stock: 500, buying: 500 });

  // The reported 430-unit run still earns a real geographic spread once. Its second
  // full load fails against the shared source inventory instead of minting cash again.
  const before = await stateOf(first);
  const bought = await ok('POST', '/v1/goods/buy', first.token, { goodId: good, qty: 430 });
  await ok('POST', `/v1/travel/${destination}`, first.token);
  const sold = await ok('POST', '/v1/goods/sell', first.token, { goodId: good, qty: 430 });
  await ok('POST', `/v1/travel/${source}`, first.token);
  const profit = sold.earned - bought.spent - 2 * CONSTANTS.TRAVEL_COST;
  assert(profit > bought.spent, 'fixture reproduces the reported 100%+ freight margin');
  assert.equal((await stateOf(first)).cash, before.cash + profit);
  assert.deepEqual((await stateOf(first)).cargo, []);
  assert.deepEqual(await liquidity(source), { stock: 70, buying: 500 });
  assert.deepEqual(await liquidity(destination), { stock: 500, buying: 70 });
  await rejectedTrade(first, 'buy', 430, 'goods_stock', 70);
  const limitedTurn = await ok('GET', '/v1/agent/turn', first.token);
  const limitedPlan = sizedPlans(limitedTurn).find((p) => p.id === `arbitrage:${good}:${source}:${destination}`);
  assert.equal(limitedPlan?.quantity, 70, 'agent sizes the next load to the final 70 stock and demand');
  assert.deepEqual(limitedTurn.opportunities.niches.arbitrage.find((e) => e.good === good)?.stock, 70);

  // A second account sees the same remaining stock. Smaller purchases may consume
  // exactly what is left; neither a refused purchase nor an opposite sale refills it.
  await rejectedTrade(second, 'buy', 71, 'goods_stock', 70);
  await ok('POST', '/v1/goods/buy', second.token, { goodId: good, qty: 30 });
  assert.deepEqual(await liquidity(source), { stock: 40, buying: 500 });
  await ok('POST', '/v1/goods/buy', second.token, { goodId: good, qty: 40 });
  await rejectedTrade(first, 'buy', 1, 'goods_stock', 0);
  const rerouted = await ok('GET', '/v1/opportunities', first.token);
  const newSource = rerouted.niches.arbitrage.find((e) => e.good === good);
  assert(newSource, 'other suppliers keep the good available after one district sells out');
  assert.notEqual(newSource.buyIn, source, 'opportunities reroute away from exhausted source stock');
  assert.equal(newSource.stock, 500);
  assert.equal(newSource.buying, 70);
  const reroutedTurn = await ok('GET', '/v1/agent/turn', first.token);
  const reroutedPlan = sizedPlans(reroutedTurn).find((p) => p.id.startsWith(`arbitrage:${good}:`));
  assert(reroutedPlan && reroutedPlan.buyIn !== source && reroutedPlan.quantity <= 70,
    'agent follows available suppliers and retains the destination demand limit');
  const staleBefore = await stateOf(first);
  const staleAction = await call('POST', '/v1/agent/act', first.token,
    { turnId: limitedTurn.turnId, actionId: limitedPlan.nextActionId });
  assert.equal(staleAction.body.error, 'stale_turn', 'shared depletion invalidates previously issued procurement authority');
  assert.deepEqual(await stateOf(first), staleBefore, 'obsolete agent action spends no cash and adds no cargo');
  await ok('POST', '/v1/goods/sell', second.token, { goodId: good, qty: 70 });
  assert.deepEqual(await liquidity(source), { stock: 0, buying: 430 }, 'selling does not refill NPC stock');
  await rejectedTrade(first, 'buy', 1, 'goods_stock', 0);

  // Demand is an independent shared allowance. Buying at the destination does not
  // reopen its consumed demand; partial sales drain its exact final 70 units.
  await ok('POST', `/v1/travel/${destination}`, second.token);
  await ok('POST', '/v1/goods/buy', second.token, { goodId: good, qty: 71 });
  assert.deepEqual(await liquidity(destination), { stock: 429, buying: 70 });
  await rejectedTrade(second, 'sell', 71, 'goods_demand', 70);
  await ok('POST', '/v1/goods/sell', second.token, { goodId: good, qty: 30 });
  assert.deepEqual(await liquidity(destination), { stock: 429, buying: 40 });
  await ok('POST', '/v1/goods/sell', second.token, { goodId: good, qty: 40 });
  await rejectedTrade(second, 'sell', 1, 'goods_demand', 0);
  assert.deepEqual(await liquidity(destination), { stock: 429, buying: 0 });
  const newBuyer = (await ok('GET', '/v1/opportunities', first.token)).niches.arbitrage.find((e) => e.good === good);
  assert(newBuyer && newBuyer.sellIn !== destination && newBuyer.buying > 0,
    'opportunities reroute away from exhausted buyer demand');
  sizedPlans(await ok('GET', '/v1/agent/turn', first.token));

  // Catalog entries and districts are isolated, while every public read agrees on
  // depletion. A new module instance and DB connection cannot reset durable counters.
  assert.deepEqual(await liquidity(source, 'gin'), { stock: 500, buying: 500 });
  assert.deepEqual(await liquidity('canal'), { stock: 500, buying: 500 });
  const prices = await ok('GET', '/v1/market/prices');
  const street = await ok('GET', '/v1/block', first.token);
  assert.deepEqual(street.prices.liquidity, prices.liquidity, 'aggregate and price API publish identical liquidity');
  const reloaded = await import('../src/goodsmarket.js?durability-regression');
  const freshClient = await pool.connect();
  try {
    const reread = await reloaded.goodsLiquidityBoard(freshClient, block);
    assert.deepEqual(reread, prices.liquidity, 'fresh helper instance reads depleted counters from the database');
  } finally {
    freshClient.release();
  }
  assert.deepEqual((await goodsLiquidityBoard(pool, block)).districts[source][good], { stock: 0, buying: 430 });

  // A real four-hour rollover restores both quotas. Old quotes cannot consume the
  // new block, and quotes from a future block cannot prematurely reopen inventory.
  await assert.rejects(
    consumeGoodsLiquidity(pool, good, source, 'buy', 1, block + 1),
    (err) => err.code === 'price_changed');
  assert.deepEqual(await liquidity(source), { stock: 0, buying: 430 });
  now = (block + 1) * 4 * 3600 * 1000 + 1000;
  const next = await goodsLiquidityBoard(pool, block + 1);
  assert.deepEqual(next.districts[source][good], { stock: 500, buying: 500 });
  assert.deepEqual(next.districts[destination][good], { stock: 500, buying: 500 });
  await assert.rejects(
    consumeGoodsLiquidity(pool, good, source, 'buy', 1, block),
    (err) => err.code === 'price_changed');
  await consumeGoodsLiquidity(pool, good, source, 'buy', 10, block + 1);
  await consumeGoodsLiquidity(pool, good, source, 'sell', 20, block + 1);
  assert.deepEqual((await goodsLiquidityBoard(pool, block + 1)).districts[source][good], { stock: 490, buying: 480 });

  // Different accounts use different character locks, so the market's own guarded
  // write must prevent two competing 300-unit fills from spending a 500-unit quota.
  for (const [side, error] of [['buy', 'goods_stock'], ['sell', 'goods_demand']]) {
    const fills = await Promise.allSettled([
      consumeGoodsLiquidity(pool, 'gin', 'cathedral', side, 300, block + 1),
      consumeGoodsLiquidity(pool, 'gin', 'cathedral', side, 300, block + 1),
    ]);
    assert.equal(fills.filter((r) => r.status === 'fulfilled').length, 1);
    const failed = fills.find((r) => r.status === 'rejected');
    assert.equal(failed.reason.code, error);
    assert.equal(failed.reason.data.available, 200);
  }
  assert.deepEqual((await goodsLiquidityBoard(pool, block + 1)).districts.cathedral.gin, { stock: 200, buying: 200 });

  // Supply exhaustion must block procurement without hiding buyers for cargo that
  // is already owned. Retain a liquidation action even when every supplier is empty.
  const remaining = await goodsLiquidityBoard(pool, block + 1);
  for (const [district, goods] of Object.entries(remaining.districts)) {
    if (goods[good].stock > 0) {
      await consumeGoodsLiquidity(pool, good, district, 'buy', goods[good].stock, block + 1);
    }
  }
  const emptySupply = await ok('GET', '/v1/opportunities', first.token);
  const liquidationEdge = emptySupply.niches.arbitrage.find((e) => e.good === good);
  assert(liquidationEdge && liquidationEdge.stock === 0 && liquidationEdge.buying >= 3,
    'exhausted supply retains an available buyer for held freight');
  assert.equal(emptySupply.best?.kind, 'arbitrage', 'other supplied goods still offer a profitable recommendation');
  assert(!emptySupply.best.endpoint.startsWith(`buy ${good} `), 'best opportunity never recommends zero-stock procurement');
  await pool.query('INSERT INTO character_cargo (character_id, good_id, qty) VALUES ($1,$2,$3)', [first.id, good, 3]);
  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [first.id, liquidationEdge.sellIn]);
  const liquidationTurn = await ok('GET', '/v1/agent/turn', first.token);
  const liquidationPlan = liquidationTurn.plans.find((p) => p.id.startsWith(`arbitrage:${good}:`));
  assert.equal(liquidationPlan?.quantity, 3, 'agent keeps a sale plan for all three already-owned units');
  assert.equal(liquidationPlan.status, 'sell');
  const liquidationAction = liquidationTurn.actions.find((a) => a.id === liquidationPlan.nextActionId);
  assert.equal(liquidationAction?.kind, 'arbitrage_sell');
  assert.deepEqual(liquidationAction.body, { goodId: good, qty: 3 });
  assert(!liquidationTurn.actions.some((a) => a.kind === 'arbitrage_buy' && a.body.goodId === good),
    'agent never issues an exhausted procurement action');
  await ok('POST', '/v1/agent/act', first.token,
    { turnId: liquidationTurn.turnId, actionId: liquidationAction.id });
  assert.deepEqual((await stateOf(first)).cargo, [], 'held freight can actually liquidate after all suppliers run dry');
  assert.equal((await liquidity(liquidationEdge.sellIn)).stock, 0, 'liquidation cannot reopen exhausted stock');
  console.log('goods-market: finite shared freight stock/demand, atomic failures, concurrent fills, durable reads, block refresh and exhausted-supply liquidation passed');
} finally {
  Date.now = realNow;
  await app.close();
}
