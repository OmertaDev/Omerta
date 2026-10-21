// Resident freight uses the same finite shop inventory and exact quote as player procurement.
import assert from 'node:assert/strict';

process.env.DATABASE_URL = '';
process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'population-goods-liquidity-secret';
process.env.MARKET_SEED = 'omerta-server-seed';

const { buildServer } = await import('./server-fixture.js');
const { spawnResident, residentAct } = await import('../src/population.js');
const { consumeGoodsLiquidity, goodsLiquidityBoard, GOODS_MARKET } = await import('../src/goodsmarket.js');
const { goodsBuyQuote } = await import('../src/goodsquote.js');
const { GOODS, POPULATION, priceBlock } = await import('../src/rules.js');

const app = await buildServer();
const pool = app.pool;
const selectedGood = GOODS[0].id;
const block = priceBlock();

const preparedResident = async (id, district) => {
  await pool.query(
    `UPDATE characters SET loc=$2, guard_price=10000, fade_limit=100, duel_limit=100
      WHERE id=$1`, [id, district]);
  await pool.query(
    `INSERT INTO loans (id,lender_character,principal,rate,hours,status)
     VALUES ($1,$2,1000,0.1,24,'open')`, [`liquidity-loan-${id}`, id]);
  await pool.query(
    `INSERT INTO market_listings (id,seller_character,kind,good_id,qty,district,price,expires_at)
     VALUES ($1,$2,'order',$3,1,$4,1,now()+interval '1 day')`,
    [`liquidity-order-${id}`, id, selectedGood, district]);
};

const act = async (id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resident = (await client.query(
      `SELECT id,cash,loc,npc_seed,guard_price,fade_limit,duel_limit
         FROM characters WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    const result = await residentAct(client, resident);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const originalRandom = Math.random;
try {
  const setup = await pool.connect();
  await setup.query('BEGIN');
  const exhausted = await spawnResident(setup, { band: POPULATION.BANDS.find((band) => band.id === 'boss'), marks: {} });
  const supplied = await spawnResident(setup, { band: POPULATION.BANDS.find((band) => band.id === 'boss'), marks: {} });
  await setup.query('COMMIT');
  setup.release();
  await preparedResident(exhausted.id, 'docks');
  await preparedResident(supplied.id, 'foundry');

  await consumeGoodsLiquidity(pool, selectedGood, 'docks', 'buy', GOODS_MARKET.STOCK_PER_BLOCK, block);
  Math.random = () => 0; // pick the exhausted first catalog good, then the first drift district
  const exhaustedCash = Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [exhausted.id])).rows[0].cash);
  assert.equal(await act(exhausted.id), 'moved', 'an empty shop makes the resident skip freight and continue its turn');
  assert.equal(Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [exhausted.id])).rows[0].cash), exhaustedCash);
  assert.equal(Number((await pool.query(
    'SELECT COUNT(*) n FROM character_cargo WHERE character_id=$1', [exhausted.id])).rows[0].n), 0,
  'an exhausted shop creates no resident cargo');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM transactions WHERE character_id=$1 AND reason LIKE 'goods:buy:%'", [exhausted.id])).rows[0].n), 0,
  'an exhausted shop debits no resident cash');

  const before = (await pool.query('SELECT cash FROM characters WHERE id=$1', [supplied.id])).rows[0];
  assert.equal(await act(supplied.id), 'freighted', 'a stocked shop still supplies resident freight');
  const cargo = (await pool.query(
    'SELECT good_id,qty FROM character_cargo WHERE character_id=$1', [supplied.id])).rows[0];
  const quote = goodsBuyQuote(selectedGood, 'foundry', Number(cargo.qty), {}, block);
  const after = (await pool.query('SELECT cash FROM characters WHERE id=$1', [supplied.id])).rows[0];
  assert.equal(cargo.good_id, selectedGood);
  assert.equal(Number(before.cash) - Number(after.cash), quote.total, 'resident debit equals the shared exact buy quote');
  assert.equal((await goodsLiquidityBoard(pool, block)).districts.foundry[selectedGood].stock,
    GOODS_MARKET.STOCK_PER_BLOCK - Number(cargo.qty), 'resident freight consumes shared global shop stock');
} finally {
  Math.random = originalRandom;
  await app.close();
}

console.log('population goods liquidity tests passed');
