// Resident integration proofs for the shared goods quota. Never reads DATABASE_URL or project credentials.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { Pool } from 'pg';
import { residentAct } from '../src/population.js';
import { consumeGoodsLiquidity, goodsLiquidityBoard, GOODS_MARKET } from '../src/goodsmarket.js';
import { goodsBuyQuote } from '../src/goodsquote.js';
import { GOODS, POPULATION, priceBlock } from '../src/rules.js';

assert(process.env.GOODS_MARKET_TEST_DATABASE_URL, 'Explicit GOODS_MARKET_TEST_DATABASE_URL required');
const endpoint = new URL(process.env.GOODS_MARKET_TEST_DATABASE_URL);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only disposable loopback PostgreSQL is allowed');
assert(endpoint.port && (endpoint.port !== '5432' || process.env.CI === 'true'),
  'Use a disposable PostgreSQL server on an explicit nondefault port; 5432 is allowed only in CI');
assert(/^\/goods_market_test(?:_[a-z0-9]+)?$/.test(endpoint.pathname), 'Use a database named goods_market_test');
const namespace = 'population_goods_test_' + crypto.randomBytes(8).toString('hex');
const admin = new Pool({ connectionString: endpoint.toString(), max: 2 });
const pool = new Pool({ connectionString: endpoint.toString(), max: 6,
  options: `-c search_path=${namespace} -c lock_timeout=10000 -c statement_timeout=10000` });
const realNow = Date.now, realRandom = Math.random;
let clock = Math.floor(realNow() / GOODS_MARKET.BLOCK_MS) * GOODS_MARKET.BLOCK_MS + 60_000;
Date.now = () => clock;
Math.random = () => 0; // Pick the first catalog good and a predictable drift destination.
const good = GOODS[0].id, district = 'docks', qty = POPULATION.MARKS.GOODS_MAX_UNITS;
const seedCash = 60000;
let serial = 0, passed = 0;
const pass = name => { passed++; console.log('PASS ' + name); };
const quote = () => goodsBuyQuote(good, district, qty, {}, priceBlock());

async function resident() {
  assert(quote().total <= Math.min(Math.floor(seedCash * (1 - POPULATION.BEHAVIOUR.KEEP_FLOOR)),
    Math.floor(seedCash * POPULATION.MARKS.GOODS_BPS / 10000)), 'Fixture must afford a full resident load');
  const id = 'freight-resident-' + ++serial;
  await pool.query(
    `INSERT INTO characters (id,account_id,name,season,is_npc,cash,npc_seed,loc,guard_price,fade_limit,duel_limit)
     VALUES ($1,$1,$1,1,true,$2,$2,$3,10000,100,100)`, [id, seedCash, district]);
  await pool.query(
    "INSERT INTO transactions (id,character_id,currency,amount,reason) VALUES ($1,$2,'cash',$3,'npc:seed')",
    [crypto.randomUUID(), id, seedCash]);
  // Existing offers make this turn reach freight rather than create another escrow.
  await pool.query('INSERT INTO loans (id,lender_character,principal,rate,hours) VALUES ($1,$1,100,0.1,1)', [id]);
  await pool.query(
    `INSERT INTO market_listings (id,seller_character,kind,good_id,qty,price,expires_at)
     VALUES ($1,$1,'order',$2,1,100,now()+interval '1 day')`, [id, good]);
  return id;
}
async function snapshot(client, id) {
  return {
    cash: Number((await client.query('SELECT cash FROM characters WHERE id=$1', [id])).rows[0].cash),
    cargo: (await client.query('SELECT good_id,qty FROM character_cargo WHERE character_id=$1 ORDER BY good_id', [id])).rows,
    receipts: (await client.query(
      'SELECT id,currency,amount,reason FROM transactions WHERE character_id=$1 ORDER BY id', [id])).rows,
    tax: Number((await client.query('SELECT pool FROM street_tax WHERE id=1')).rows[0].pool),
  };
}
const liquidity = async () => (await pool.query(
  'SELECT good_id,district,price_block,bought,sold FROM goods_market_liquidity ORDER BY district,good_id')).rows;
async function stock(bought, sold = 11) {
  await pool.query('DELETE FROM goods_market_liquidity');
  if (bought !== null) await pool.query(
    'INSERT INTO goods_market_liquidity (good_id,district,price_block,bought,sold) VALUES ($1,$2,$3,$4,$5)',
    [good, district, priceBlock(), bought, sold]);
}
async function purchase(client, id) {
  const row = (await client.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [id])).rows[0];
  return residentAct(client, row);
}
async function settled(client, id, before, terms) {
  const after = await snapshot(client, id);
  assert.deepEqual(after.cargo, [{ good_id: good, qty }]);
  assert.equal(after.cash, before.cash - terms.total);
  assert.equal(after.tax, before.tax + terms.tax);
  const added = after.receipts.filter(row => !before.receipts.some(prior => prior.id === row.id));
  assert.equal(after.receipts.length, before.receipts.length + 1);
  assert.deepEqual(added.map(({ currency, amount, reason }) => ({ currency, amount: Number(amount), reason })),
    [{ currency: 'cash', amount: -terms.total, reason: `goods:buy:${good}` }]);
}
// Observe a real lock wait on a distinct connection; no timing-only Promise.all "race" proof.
async function waitForLock(pid) {
  const deadline = realNow() + 5000;
  while (realNow() < deadline) {
    const row = (await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0];
    if (row?.wait_event_type === 'Lock') return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail('Expected an observed PostgreSQL lock wait');
}

try {
  await admin.query(`CREATE SCHEMA ${namespace}`);
  console.log(`PostgreSQL ${(await admin.query('SHOW server_version')).rows[0].server_version}; Node ${process.version}; isolated schema ${namespace}`);
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  await pool.query('INSERT INTO street_tax (id) VALUES (1) ON CONFLICT (id) DO NOTHING');

  // Compete with the same quota consumer used by player procurement, in both lock orders.
  for (const residentFirst of [false, true]) {
    await stock(GOODS_MARKET.STOCK_PER_BLOCK - qty);
    const id = await resident(), before = await snapshot(pool, id), terms = quote();
    const holder = await pool.connect(), waiter = await pool.connect();
    try {
      await holder.query('BEGIN'); await waiter.query('BEGIN');
      const pid = (await waiter.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      if (residentFirst) assert.equal(await purchase(holder, id), 'freighted');
      else await consumeGoodsLiquidity(holder, good, district, 'buy', qty, priceBlock());
      const pending = (residentFirst
        ? consumeGoodsLiquidity(waiter, good, district, 'buy', qty, priceBlock())
        : purchase(waiter, id)).then(value => ({ value }), error => ({ error }));
      await waitForLock(pid);
      await holder.query('COMMIT');
      const outcome = await pending;
      if (residentFirst) {
        assert.equal(outcome.error?.code, 'goods_stock');
        assert.equal(outcome.error.data.available, 0);
        await waiter.query('ROLLBACK');
        await settled(pool, id, before, terms);
      } else {
        assert.equal(outcome.error, undefined);
        assert.equal(outcome.value, 'moved', 'exhaustion skips freight and commits the ordinary drift');
        await waiter.query('COMMIT');
        assert.deepEqual(await snapshot(pool, id), before, 'losing resident changes no cash, cargo, receipts or tax');
        assert.notEqual((await pool.query('SELECT loc FROM characters WHERE id=$1', [id])).rows[0].loc, district);
      }
      assert.deepEqual((await goodsLiquidityBoard(pool)).districts[district][good],
        { stock: 0, buying: GOODS_MARKET.DEMAND_PER_BLOCK - 11 });
      pass(`${residentFirst ? 'resident' : 'competing consumer'} wins final-load lock race; quota cannot overdraw`);
    } finally {
      await holder.query('ROLLBACK'); await waiter.query('ROLLBACK');
      holder.release(); waiter.release();
    }
  }

  for (const initial of [null, 7]) {
    await stock(initial);
    const id = await resident(), before = await snapshot(pool, id), beforeLiquidity = await liquidity();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      assert.equal(await purchase(client, id), 'freighted');
      await settled(client, id, before, quote()); // Prove every write happened before the injected failure.
      await assert.rejects(client.query('SELECT 1/0'), error => error.code === '22012');
      await client.query('ROLLBACK');
      assert.deepEqual(await snapshot(pool, id), before);
      assert.deepEqual(await liquidity(), beforeLiquidity);
      await client.query('BEGIN');
      assert.equal(await purchase(client, id), 'freighted', 'a fresh turn can use the rolled-back quota');
      await client.query('COMMIT');
      await settled(pool, id, before, quote());
      assert.deepEqual((await goodsLiquidityBoard(pool)).districts[district][good],
        { stock: GOODS_MARKET.STOCK_PER_BLOCK - (initial ?? 0) - qty,
          buying: GOODS_MARKET.DEMAND_PER_BLOCK - (initial === null ? 0 : 11) });
      pass(`downstream failure atomically rolls back resident settlement and ${initial === null ? 'new' : 'existing'} quota; retry settles once`);
    } finally { await client.query('ROLLBACK'); client.release(); }
  }

  for (const firstTouch of [false, true]) {
    await stock(firstTouch ? null : 7);
    const id = await resident(), before = await snapshot(pool, id), oldBlock = priceBlock();
    const holder = await pool.connect(), waiter = await pool.connect();
    try {
      await holder.query('BEGIN'); await waiter.query('BEGIN');
      if (firstTouch) await consumeGoodsLiquidity(holder, good, district, 'buy', 7, oldBlock);
      else await holder.query('SELECT * FROM goods_market_liquidity WHERE good_id=$1 AND district=$2 FOR UPDATE', [good, district]);
      const pid = (await waiter.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const pending = purchase(waiter, id).then(value => ({ value }), error => ({ error }));
      await waitForLock(pid);
      clock += GOODS_MARKET.BLOCK_MS;
      await holder.query('COMMIT');
      assert.equal((await pending).error?.code, 'price_changed', 'resident must propagate expiry for caller rollback');
      await waiter.query('ROLLBACK');
      assert.deepEqual(await snapshot(pool, id), before);
      assert.equal((await pool.query('SELECT loc FROM characters WHERE id=$1', [id])).rows[0].loc, district);
      assert.deepEqual(await liquidity(), [{ good_id: good, district, price_block: oldBlock, bought: 7, sold: firstTouch ? 0 : 11 }]);
      pass(`resident quote expiring during ${firstTouch ? 'first-touch insertion' : 'existing-row'} lock wait cannot settle or burn quota`);
    } finally {
      await holder.query('ROLLBACK'); await waiter.query('ROLLBACK');
      holder.release(); waiter.release();
    }
  }
  console.log(`Population goods PostgreSQL: ${passed} proofs passed`);
} finally {
  Date.now = realNow; Math.random = realRandom;
  await pool.end();
  try { await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); }
  finally { await admin.end(); }
}
