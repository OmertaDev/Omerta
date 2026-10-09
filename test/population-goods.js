// Real resident freight regression; native mode uses a disposable loopback database
// and private schema, never DATABASE_URL or project credentials.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { Pool } from 'pg';
import { makeDb } from '../src/db.js';
import { residentAct, runResidentBehaviour } from '../src/population.js';
import { consumeGoodsLiquidity, goodsLiquidityBoard, GOODS_MARKET } from '../src/goodsmarket.js';
import { GOODS, POPULATION, goodPriceOf, priceBlock } from '../src/rules.js';

const postgres = process.argv.includes('--postgres');
const namespace = 'population_goods_test_' + crypto.randomBytes(8).toString('hex');
const realNow = Date.now, realRandom = Math.random;
let clock = Math.floor(realNow() / GOODS_MARKET.BLOCK_MS) * GOODS_MARKET.BLOCK_MS + 60_000;
Date.now = () => clock;
Math.random = () => 0; // residentAct chooses the first good, reproducibly.
const good = GOODS[0].id, district = 'docks', qty = POPULATION.MARKS.GOODS_MAX_UNITS;
let pool, admin, serial = 0, passed = 0;
const pass = name => { passed++; console.log('PASS ' + name); };

async function resident() {
  const id = 'freight-resident-' + ++serial;
  await pool.query(
    'INSERT INTO characters (id,account_id,name,season,is_npc,cash,npc_seed,loc,guard_price,fade_limit,duel_limit) VALUES ($1,$1,$1,1,true,60000,60000,$2,10000,1,1)',
    [id, district]);
  await pool.query(
    'INSERT INTO transactions (id,character_id,currency,amount,reason) VALUES ($1,$2,$3,$4,$5)',
    [crypto.randomUUID(), id, 'cash', 60000, 'npc:seed']);
  // Existing offers make this turn reach freight rather than create another escrow.
  await pool.query('INSERT INTO loans (id,lender_character,principal,rate,hours) VALUES ($1,$1,100,0.1,1)', [id]);
  await pool.query(
    "INSERT INTO market_listings (id,seller_character,kind,good_id,qty,price,expires_at) VALUES ($1,$1,'order',$2,1,100,now()+interval '1 day')", [id, good]);
  return id;
}
async function snapshot(id) {
  return {
    cash: Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [id])).rows[0].cash),
    cargo: (await pool.query('SELECT good_id,qty FROM character_cargo WHERE character_id=$1 ORDER BY good_id', [id])).rows,
    ledger: Number((await pool.query("SELECT COALESCE(SUM(amount),0) AS n FROM transactions WHERE character_id=$1 AND currency='cash'", [id])).rows[0].n),
    tax: Number((await pool.query('SELECT pool FROM street_tax WHERE id=1')).rows[0].pool),
  };
}
const availability = async () => (await goodsLiquidityBoard(pool)).districts[district][good];
async function purchase(client, id) {
  const row = (await client.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [id])).rows[0];
  return residentAct(client, row);
}
async function turn(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await purchase(client, id);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
async function stock(bought, sold = 0) {
  await pool.query('DELETE FROM goods_market_liquidity');
  await pool.query(
    'INSERT INTO goods_market_liquidity (good_id,district,price_block,bought,sold) VALUES ($1,$2,$3,$4,$5)',
    [good, district, priceBlock(), bought, sold]);
}
async function waitForLock(pid) {
  const deadline = realNow() + 5000;
  while (realNow() < deadline) {
    if ((await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0]?.wait_event_type === 'Lock') return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail('Expected an observed PostgreSQL lock wait');
}

try {
  if (postgres) {
    assert(process.env.GOODS_MARKET_TEST_DATABASE_URL, 'Explicit GOODS_MARKET_TEST_DATABASE_URL required');
    const endpoint = new URL(process.env.GOODS_MARKET_TEST_DATABASE_URL);
    assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only disposable loopback PostgreSQL is allowed');
    assert(endpoint.port && (endpoint.port !== '5432' || process.env.CI === 'true'), 'Use an explicit nondefault port outside CI');
    assert(/^\/goods_market_test(?:_[a-z0-9]+)?$/.test(endpoint.pathname), 'Use a database named goods_market_test');
    admin = new Pool({ connectionString: endpoint.toString(), max: 2 });
    await admin.query('CREATE SCHEMA ' + namespace);
    pool = new Pool({ connectionString: endpoint.toString(), max: 6,
      options: '-c search_path=' + namespace + ' -c lock_timeout=10000 -c statement_timeout=10000' });
    await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  } else {
    process.env.DATABASE_URL = '';
    pool = await makeDb();
  }
  await pool.query('INSERT INTO street_tax (id) VALUES (1) ON CONFLICT (id) DO NOTHING');

  const empty = await resident();
  await stock(500, 37);
  const beforeEmpty = await snapshot(empty);
  await assert.rejects(turn(empty), error => error.code === 'goods_stock' && error.data.available === 0);
  assert.deepEqual(await snapshot(empty), beforeEmpty, 'exhaustion creates no cargo, charge, ledger row or tax');
  assert.deepEqual(await availability(), { stock: 0, buying: 463 });
  pass('player-exhausted shared stock rejects resident freight without changing money or cargo');

  const first = await resident(), second = await resident();
  await stock(500 - qty - 5, 37);
  const before = await snapshot(first);
  assert.equal(await turn(first), 'freighted');
  const after = await snapshot(first);
  const cost = Math.round(goodPriceOf(good, district, priceBlock())) * qty;
  const take = Math.ceil(cost * 0.01);
  assert.deepEqual(after.cargo, [{ good_id: good, qty }]);
  assert.equal(after.cash, before.cash - cost - 2 * take);
  assert.equal(after.ledger - before.ledger, after.cash - before.cash);
  assert.equal(after.tax, before.tax + take);
  assert.deepEqual(await availability(), { stock: 5, buying: 463 });
  const beforePartial = await snapshot(second);
  await assert.rejects(turn(second), error => error.code === 'goods_stock' && error.data.available === 5);
  assert.deepEqual(await snapshot(second), beforePartial, 'an insufficient partial quota cannot settle');
  assert.deepEqual(await availability(), { stock: 5, buying: 463 });
  pass('partial stock permits one full resident load, then rejects an oversized load with exact cash/ledger/tax');

  const loaded = await snapshot(first);
  assert.equal(await turn(first), 'moved');
  assert.deepEqual(await snapshot(first), loaded);
  assert.deepEqual(await availability(), { stock: 5, buying: 463 });
  await consumeGoodsLiquidity(pool, good, district, 'buy', 5, priceBlock());
  assert.equal((await availability()).stock, 0, 'player consumption uses the same remaining five units');
  pass('repeated resident turns do not double charge; player consumption exhausts the same remaining bucket');

  const beforeWorker = await snapshot(empty);
  await pool.query('UPDATE population_state SET behaviour_turn=$1 WHERE id=1',
    [JSON.stringify({ hour: Math.floor(realNow() / 3600000), pending: [empty] })]);
  assert.deepEqual(await runResidentBehaviour(pool), { acted: 0, actions: {} });
  assert.deepEqual(await runResidentBehaviour(pool), { acted: 0, actions: {} });
  assert.deepEqual(await snapshot(empty), beforeWorker);
  assert.deepEqual((await pool.query('SELECT behaviour_turn FROM population_state WHERE id=1')).rows[0].behaviour_turn.pending, []);
  pass('worker acknowledges exhausted stock and does not duplicate a failed resident turn');

  if (postgres) {
    for (const residentFirst of [false, true]) {
      await stock(500 - qty, 11);
      const id = await resident(), beforeRace = await snapshot(id);
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
        assert.equal(outcome.error?.code, 'goods_stock');
        await waiter.query('ROLLBACK');
        assert.deepEqual(await availability(), { stock: 0, buying: 489 });
        const settled = await snapshot(id);
        if (residentFirst) {
          assert.deepEqual(settled.cargo, [{ good_id: good, qty }]);
          assert.equal(settled.cash, beforeRace.cash - cost - 2 * take);
          assert.equal(settled.ledger - beforeRace.ledger, settled.cash - beforeRace.cash);
          assert.equal(settled.tax, beforeRace.tax + take);
        } else assert.deepEqual(settled, beforeRace);
        pass((residentFirst ? 'resident' : 'player') + ' wins final-load lock race; losing purchase cannot overdraw stock');
      } finally {
        await holder.query('ROLLBACK'); await waiter.query('ROLLBACK');
        holder.release(); waiter.release();
      }
    }

    await stock(0);
    const rollbackId = await resident(), beforeRollback = await snapshot(rollbackId);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await purchase(client, rollbackId);
      await assert.rejects(client.query('SELECT 1/0'), error => error.code === '22012');
      await client.query('ROLLBACK');
      assert.deepEqual(await snapshot(rollbackId), beforeRollback);
      assert.deepEqual(await availability(), { stock: 500, buying: 500 });
      pass('downstream failure rolls back resident cargo, cash, ledger, tax and quota together');
    } finally { await client.query('ROLLBACK'); client.release(); }

    await stock(0);
    const staleId = await resident(), beforeStale = await snapshot(staleId);
    const holder = await pool.connect(), waiter = await pool.connect();
    try {
      await holder.query('BEGIN'); await waiter.query('BEGIN');
      await holder.query('SELECT * FROM goods_market_liquidity WHERE good_id=$1 AND district=$2 FOR UPDATE', [good, district]);
      const pid = (await waiter.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const pending = purchase(waiter, staleId).then(value => ({ value }), error => ({ error }));
      await waitForLock(pid);
      clock += GOODS_MARKET.BLOCK_MS;
      await holder.query('COMMIT');
      assert.equal((await pending).error?.code, 'price_changed');
      await waiter.query('ROLLBACK');
      assert.deepEqual(await snapshot(staleId), beforeStale);
      assert.equal((await pool.query('SELECT bought FROM goods_market_liquidity')).rows[0].bought, 0);
      pass('resident quote expiring during a PostgreSQL lock wait rolls back without settling');
    } finally {
      await holder.query('ROLLBACK'); await waiter.query('ROLLBACK');
      holder.release(); waiter.release();
    }
  }
  console.log('Population goods: ' + passed + ' proofs passed (' + (postgres ? 'PostgreSQL' : 'pg-mem') + ')');
} finally {
  Date.now = realNow; Math.random = realRandom;
  if (pool) await pool.end();
  if (admin) { await admin.query('DROP SCHEMA IF EXISTS ' + namespace + ' CASCADE'); await admin.end(); }
}

