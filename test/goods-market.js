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

const { buildServer } = await import('./server-fixture.js');
const { priceBlock, CONSTANTS, DISTRICTS, GOODS } = await import('../src/rules.js');
const { consumeGoodsLiquidity, goodsLiquidityBoard } = await import('../src/goodsmarket.js');
const { goodsBuyQuote, goodsSellQuote } = await import('../src/goodsquote.js');
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
  const priceBoard = await ok('GET', '/v1/market/prices');
  const board = priceBoard.liquidity;
  assert.equal(board.stockPerBlock, 500);
  assert.equal(board.demandPerBlock, 500);
  assert.equal(board.dailyLotUnits, 10, 'the public board defines one meaningful freight lot');
  assert.equal(board.refreshAt, new Date((block + 1) * 4 * 3600 * 1000).toISOString());
  assert.deepEqual(board.districts[source][good], { stock: 500, buying: 500 });
  assert.equal(priceBoard.goodsBuy[source][good], goodsBuyQuote(good, source, 1, {}, block).unit,
    'the public ask uses settlement quote semantics');
  assert.equal(priceBoard.goodsSell[source][good], goodsSellQuote(good, source, 1, {}, {}, block).unit,
    'the public bid uses settlement quote semantics');
  assert(priceBoard.goodsSell[source][good] < priceBoard.goodsBuy[source][good],
    'the public board does not advertise a crossed same-shop book');
  const quotedEdge = (await ok('GET', '/v1/opportunities', first.token)).niches.arbitrage[0];
  assert(quotedEdge, 'the player-facing opportunity board publishes a freight edge');
  assert.equal(quotedEdge.buyPrice,
    goodsBuyQuote(quotedEdge.good, quotedEdge.buyIn, 1, {}, block).unit,
    'opportunity buy units use the settlement quote');
  assert.equal(quotedEdge.sellPrice,
    goodsSellQuote(quotedEdge.good, quotedEdge.sellIn, 1, {}, {}, block).unit,
    'opportunity sell units use the settlement quote');

  // The 430-unit run still earns a real geographic spread once after the NPC
  // resale basis closes local round trips. Its second full load fails against
  // the shared source inventory instead of minting cash again.
  const before = await stateOf(first);
  const bought = await ok('POST', '/v1/goods/buy', first.token, { goodId: good, qty: 430 });
  await ok('POST', `/v1/travel/${destination}`, first.token);
  const sold = await ok('POST', '/v1/goods/sell', first.token, { goodId: good, qty: 430 });
  await ok('POST', `/v1/travel/${source}`, first.token);
  const profit = sold.earned - bought.spent - 2 * CONSTANTS.TRAVEL_COST;
  assert(profit > 0, 'fixture retains a profitable geographic freight route');
  assert(profit < bought.spent, 'resale basis removes the former 100%+ extraction margin');
  assert.equal((await stateOf(first)).cash, before.cash + profit);
  assert.deepEqual((await stateOf(first)).cargo, []);
  assert.equal(Number((await pool.query(
    "SELECT xp FROM masteries WHERE character_id=$1 AND track_id='commerce'", [first.id])).rows[0].xp), 86,
  'a 430-unit NPC sale awards 43 ten-unit lots, rather than one request');
  assert.equal(JSON.parse((await pool.query(
    'SELECT counters FROM daily_progress WHERE character_id=$1', [first.id])).rows[0].counters).goods, 86,
  'daily progress follows the 86 ten-unit lots actually moved, rather than two requests');
  assert.deepEqual(await liquidity(source), { stock: 70, buying: 500 });
  assert.deepEqual(await liquidity(destination), { stock: 500, buying: 70 });
  await rejectedTrade(first, 'buy', 430, 'goods_stock', 70);
  await pool.query("UPDATE characters SET path='gun' WHERE id=$1", [first.id]);
  const personalizedBoard = await ok('GET', '/v1/opportunities', first.token);
  for (const edge of personalizedBoard.niches.arbitrage) {
    assert.equal(edge.buyPrice,
      goodsBuyQuote(edge.good, edge.buyIn, 1, {}, edge.priceBlock).unit,
      'player-facing opportunity procurement uses the actor settlement quote');
    assert.equal(edge.sellPrice,
      goodsSellQuote(edge.good, edge.sellIn, 1, {}, { path: 'gun' }, edge.priceBlock).unit,
      'player-facing opportunity liquidation includes the actor path modifier');
  }
  assert(personalizedBoard.niches.arbitrage.some((edge) => edge.sellPrice !==
    goodsSellQuote(edge.good, edge.sellIn, 1, {}, {}, edge.priceBlock).unit),
  'the fixture proves the personalized board differs from a neutral quote');
  const limitedTurn = await ok('GET', '/v1/agent/turn', first.token);
  const limitedPlan = sizedPlans(limitedTurn).find((p) => p.id === `arbitrage:${good}:${source}:${destination}`);
  assert.equal(limitedPlan?.quantity, 70, 'agent sizes the next load to the final 70 stock and demand');
  assert.deepEqual(limitedTurn.opportunities.niches.arbitrage.find((e) => e.good === good)?.stock, 70);
  for (const plan of limitedTurn.plans.filter((candidate) => candidate.kind === 'arbitrage')) {
    const edge = limitedTurn.opportunities.niches.arbitrage.find((candidate) =>
      plan.id === `arbitrage:${candidate.good}:${candidate.buyIn}:${candidate.sellIn}`);
    const buy = goodsBuyQuote(edge.good, edge.buyIn, plan.quantity, {}, edge.priceBlock);
    const sell = goodsSellQuote(edge.good, edge.sellIn, plan.quantity, {}, { path: 'gun' }, edge.priceBlock);
    const travel = (limitedTurn.state.identity.district === edge.buyIn ? 0 : CONSTANTS.TRAVEL_COST)
      + (edge.buyIn === edge.sellIn ? 0 : CONSTANTS.TRAVEL_COST);
    const exactProfit = sell.net - buy.total - travel;
    assert.equal(plan.buyPrice, buy.unit, 'agent procurement price uses the actor settlement quote');
    assert.equal(plan.sellPrice, sell.unit, 'agent liquidation price includes the actor path modifier');
    assert.equal(plan.ev.cash, exactProfit, 'agent profit matches exact executable settlement and travel');
    assert(exactProfit >= 25, 'agent never recommends a route below its published profit floor');
    assert.match(plan.ev.basis, /path/, 'agent discloses the personalized modifier basis');
  }

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

  // One-unit request spam moves real goods and pays the spread. Daily and mastery progress follow
  // the volume itself, so splitting the same freight cannot manufacture extra progress.
  const splitter = await create('Tiny Freight');
  for (let i = 0; i < 9; i++) {
    await ok('POST', '/v1/goods/buy', splitter.token, { goodId: 'shine', qty: 1 });
    await ok('POST', '/v1/goods/sell', splitter.token, { goodId: 'shine', qty: 1 });
  }
  assert.equal(JSON.parse((await pool.query(
    'SELECT counters FROM daily_progress WHERE character_id=$1', [splitter.id])).rows[0].counters).goods, 1.8,
  'nine one-unit round trips record exactly 18/10 lots of freight volume');
  assert.equal(Number((await pool.query(
    "SELECT xp FROM masteries WHERE character_id=$1 AND track_id='commerce'", [splitter.id])).rows[0].xp), 1.8,
  'nine one-unit sales award exactly their fractional freight XP');
  await ok('POST', '/v1/goods/buy', splitter.token, { goodId: 'shine', qty: 10 });
  await ok('POST', '/v1/goods/sell', splitter.token, { goodId: 'shine', qty: 10 });
  assert.equal(JSON.parse((await pool.query(
    'SELECT counters FROM daily_progress WHERE character_id=$1', [splitter.id])).rows[0].counters).goods, 3.8,
  'a starter-trunk buy and sale add exactly two daily freight lots');

  // Supply exhaustion must block procurement without hiding buyers for cargo that
  // is already owned. Retain a liquidation action even when every supplier is empty.
  const remaining = await goodsLiquidityBoard(pool, block + 1);
  for (const [district, goods] of Object.entries(remaining.districts)) {
    if (goods[good].stock > 0) {
      await consumeGoodsLiquidity(pool, good, district, 'buy', goods[good].stock, block + 1);
    }
  }
  await pool.query('INSERT INTO character_cargo (character_id, good_id, qty) VALUES ($1,$2,$3)', [first.id, good, 3]);
  const emptySupply = await ok('GET', '/v1/opportunities', first.token);
  const liquidationEdge = emptySupply.niches.arbitrage.find((e) => e.good === good);
  assert(liquidationEdge && liquidationEdge.stock === 0 && liquidationEdge.buying >= 3,
    'exhausted supply retains an available buyer for held freight');
  assert.equal(emptySupply.best?.kind, 'arbitrage', 'other supplied goods still offer a profitable recommendation');
  assert(!emptySupply.best.endpoint.startsWith(`buy ${good} `), 'best opportunity never recommends zero-stock procurement');
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

  // Zero-stock, unheld goods cannot crowd stocked routes out of the top-eight board. Exhausting
  // eight more goods leaves only ice supplied; a cargo-less actor must still see that live route.
  for (const exhausted of GOODS.slice(0, 8)) {
    const live = await goodsLiquidityBoard(pool, block + 1);
    for (const district of DISTRICTS) {
      const stock = live.districts[district.id][exhausted.id].stock;
      if (stock > 0) await consumeGoodsLiquidity(pool, exhausted.id, district.id, 'buy', stock, block + 1);
    }
  }
  const procurementActor = await create('Remaining Freight Buyer');
  const procurementBoard = await ok('GET', '/v1/opportunities', procurementActor.token);
  assert(procurementBoard.niches.arbitrage.length > 0, 'live supply still produces a procurement route');
  assert(procurementBoard.niches.arbitrage.every((edge) => edge.stock > 0),
    'unheld exhausted goods cannot occupy procurement display slots');
  assert(procurementBoard.niches.arbitrage.some((edge) => edge.good === 'ice'),
    'the final supplied good remains visible after nine other goods exhaust');

  // The public opportunity route loads the same turf ownership used by settlement. Holding every
  // district makes both sides of every published edge exercise that modifier, independent of which
  // deterministic district wins today's cheapest/richest search.
  const turfOwner = await create('Freight Turf Owner');
  await pool.query("INSERT INTO gangs (id,name,tag,treasury) VALUES ('goods-quote-gang','Freight Union','FQU',0)");
  await pool.query("INSERT INTO gang_members (gang_id,character_id,role) VALUES ('goods-quote-gang',$1,'boss')", [turfOwner.id]);
  await pool.query("UPDATE districts SET npc_holder=NULL, holder_gang='goods-quote-gang'");
  await pool.query("UPDATE characters SET path='gun' WHERE id=$1", [turfOwner.id]);
  const held = DISTRICTS.map((district) => district.id);
  const turfBoard = await ok('GET', '/v1/opportunities', turfOwner.token);
  for (const edge of turfBoard.niches.arbitrage) {
    assert.equal(edge.buyPrice, goodsBuyQuote(edge.good, edge.buyIn, 1, { held }, edge.priceBlock).unit,
      'player-facing opportunity procurement includes the actor turf discount');
    assert.equal(edge.sellPrice,
      goodsSellQuote(edge.good, edge.sellIn, 1, { held }, { path: 'gun' }, edge.priceBlock).unit,
      'player-facing opportunity liquidation includes turf and path modifiers');
  }
  assert(turfBoard.niches.arbitrage.some((edge) => edge.buyPrice !==
    goodsBuyQuote(edge.good, edge.buyIn, 1, {}, edge.priceBlock).unit),
  'the fixture proves the actor turf discount changes the published opportunity');
  console.log('goods-market: finite shared freight stock/demand, atomic failures, concurrent fills, durable reads, block refresh and exhausted-supply liquidation passed');
} finally {
  Date.now = realNow;
  await app.close();
}
