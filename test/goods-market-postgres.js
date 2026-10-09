// Explicit opt-in PostgreSQL proofs. Never reads DATABASE_URL or project credentials.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { Pool } from 'pg';
import { consumeGoodsLiquidity, goodsLiquidityBoard, GOODS_MARKET } from '../src/goodsmarket.js';

assert(process.env.GOODS_MARKET_TEST_DATABASE_URL, 'Explicit GOODS_MARKET_TEST_DATABASE_URL required');
const endpoint = new URL(process.env.GOODS_MARKET_TEST_DATABASE_URL);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only disposable loopback PostgreSQL is allowed');
assert(endpoint.port && (endpoint.port !== '5432' || process.env.CI === 'true'),
  'Use a disposable PostgreSQL server on an explicit nondefault port; 5432 is allowed only in CI');
assert(/^\/goods_market_test(?:_[a-z0-9]+)?$/.test(endpoint.pathname), 'Use a database named goods_market_test');
const namespace = 'goods_market_test_' + crypto.randomBytes(8).toString('hex');
const admin = new Pool({ connectionString: endpoint.toString(), max: 2 });
const pool = new Pool({ connectionString: endpoint.toString(), max: 6,
  options: `-c search_path=${namespace} -c lock_timeout=10000 -c statement_timeout=10000` });
const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const table = schema.match(/CREATE TABLE IF NOT EXISTS goods_market_liquidity\s*\([\s\S]*?\n\);/)?.[0];
assert(table, 'Production goods market table must exist');
const realNow = Date.now;
const firstBlock = Math.floor(realNow() / GOODS_MARKET.BLOCK_MS);
let clock = firstBlock * GOODS_MARKET.BLOCK_MS + 60_000;
let block = firstBlock;
Date.now = () => clock;
const evidence = [];
const log = (name) => { evidence.push(name); console.log('PASS ' + name); };
const snapshot = async () => (await pool.query(
  "SELECT price_block, bought, sold FROM goods_market_liquidity WHERE good_id='gin' AND district='docks'",
)).rows[0];
const clear = () => pool.query('DELETE FROM goods_market_liquidity');
const seed = (bought = 0, sold = 0) => pool.query(
  "INSERT INTO goods_market_liquidity (good_id,district,price_block,bought,sold) VALUES ('gin','docks',$1,$2,$3)",
  [block, bought, sold],
);
const rejectCode = (promise, code) => assert.rejects(promise, (error) => error.code === code, code);
async function transact(side, qty, targetBlock = block, district = 'docks') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await consumeGoodsLiquidity(client, 'gin', district, side, qty, targetBlock);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
// Observe an actual PostgreSQL lock wait instead of assuming a lucky timing delay.
async function waitForLock(pid) {
  const deadline = realNow() + 5000;
  while (realNow() < deadline) {
    const row = (await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0];
    if (row?.wait_event_type === 'Lock') return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail('Expected an observed PostgreSQL lock wait between distinct clients');
}
async function race(side, quantities, initialize) {
  await clear();
  if (initialize) await seed();
  const first = await pool.connect(), second = await pool.connect();
  try {
    await first.query('BEGIN');
    await second.query('BEGIN');
    const pid = (await second.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const a = await consumeGoodsLiquidity(first, 'gin', 'docks', side, quantities[0], block);
    const pending = consumeGoodsLiquidity(second, 'gin', 'docks', side, quantities[1], block)
      .then((value) => ({ value }), (error) => ({ error }));
    await waitForLock(pid);
    await first.query('COMMIT');
    const b = await pending;
    await second.query(b.error ? 'ROLLBACK' : 'COMMIT');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM goods_market_liquidity')).rows[0].n, 1);
    return { a, b, row: await snapshot() };
  } finally {
    await first.query('ROLLBACK');
    await second.query('ROLLBACK');
    first.release(); second.release();
  }
}

try {
  await admin.query(`CREATE SCHEMA ${namespace}`);
  const version = (await admin.query('SHOW server_version')).rows[0].server_version;
  console.log(`PostgreSQL ${version}; Node ${process.version}; isolated schema ${namespace}`);
  await pool.query(table);
  await seed(125, 75);
  await pool.query(table);
  assert.deepEqual(await snapshot(), { price_block: block, bought: 125, sold: 75 });
  log('production table schema reapplies without changing existing counters');

  for (const side of ['buy', 'sell']) {
    for (const initialize of [false, true]) {
      const { a, b, row } = await race(side, [430, 430], initialize);
      assert.equal(a[side === 'buy' ? 'stock' : 'buying'], 70);
      assert.equal(b.error?.code, side === 'buy' ? 'goods_stock' : 'goods_demand');
      assert.equal(b.error.data.available, 70);
      assert.equal(b.error.data.requested, 430);
      assert.deepEqual(row, { price_block: block, bought: side === 'buy' ? 430 : 0, sold: side === 'sell' ? 430 : 0 });
      log(`${side}: exactly one of two concurrent 430-unit settlements; ${initialize ? 'existing row' : 'first-touch insertion race'}`);
    }
    const { a, b, row } = await race(side, [230, 270], true);
    assert.equal(a[side === 'buy' ? 'stock' : 'buying'], 270);
    assert.equal(b.error, undefined);
    assert.equal(b.value[side === 'buy' ? 'stock' : 'buying'], 0);
    assert.equal(row[side === 'buy' ? 'bought' : 'sold'], 500);
    await rejectCode(transact(side, 1), side === 'buy' ? 'goods_stock' : 'goods_demand');
    log(`${side}: concurrent partial orders total exactly 500; unit 501 rejected`);
  }

  await clear();
  await transact('buy', 500);
  await transact('sell', 500);
  assert.deepEqual(await snapshot(), { price_block: block, bought: 500, sold: 500 });
  await rejectCode(transact('buy', 1), 'goods_stock');
  await rejectCode(transact('sell', 1), 'goods_demand');
  await transact('buy', 500, block, 'neon');
  const board = await goodsLiquidityBoard(pool, block);
  assert.deepEqual(board.districts.docks.gin, { stock: 0, buying: 0 });
  assert.deepEqual(board.districts.neon.gin, { stock: 0, buying: 500 });
  log('buy and sell budgets are independent; resale cannot refill stock; districts are separate');

  for (const side of ['buy', 'sell']) {
    await clear();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await consumeGoodsLiquidity(client, 'gin', 'docks', side, 430, block);
      await assert.rejects(client.query('SELECT 1/0'), (error) => error.code === '22012');
      await client.query('ROLLBACK');
      assert.equal(await snapshot(), undefined, 'failed first-touch settlement leaves no quota row');
      await transact(side, 125);
      const before = await snapshot();
      await client.query('BEGIN');
      await consumeGoodsLiquidity(client, 'gin', 'docks', side, 100, block);
      await assert.rejects(client.query('SELECT 1/0'), (error) => error.code === '22012');
      await client.query('ROLLBACK');
      assert.deepEqual(await snapshot(), before, 'failed settlement restores existing quota');
      await transact(side, 375);
      assert.equal((await snapshot())[side === 'buy' ? 'bought' : 'sold'], 500);
      log(`${side}: downstream SQL failure rolls back quota creation and quota consumption`);
    } finally { await client.query('ROLLBACK'); client.release(); }
  }

  await clear();
  await seed(500, 500);
  block += 1; clock = block * GOODS_MARKET.BLOCK_MS + 60_000;
  const rollover = await Promise.allSettled([
    transact('buy', 430), transact('buy', 430), transact('sell', 430), transact('sell', 430),
  ]);
  assert.equal(rollover.filter((result) => result.status === 'fulfilled').length, 2);
  assert.equal(rollover.filter((result) => result.status === 'rejected' && result.reason.code === 'goods_stock').length, 1);
  assert.equal(rollover.filter((result) => result.status === 'rejected' && result.reason.code === 'goods_demand').length, 1);
  assert.deepEqual(await snapshot(), { price_block: block, bought: 430, sold: 430 });
  const beforeStale = await snapshot();
  await rejectCode(transact('buy', 70, block - 1), 'price_changed');
  assert.deepEqual(await snapshot(), beforeStale);
  log('concurrent four-order block rollover resets once; stale block cannot rewind counters');

  // A request can become stale while waiting on another transaction's row lock.
  const holder = await pool.connect(), waiter = await pool.connect();
  try {
    await holder.query('BEGIN');
    await waiter.query('BEGIN');
    await holder.query("SELECT * FROM goods_market_liquidity WHERE good_id='gin' AND district='docks' FOR UPDATE");
    const pid = (await waiter.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const pending = consumeGoodsLiquidity(waiter, 'gin', 'docks', 'buy', 70, block)
      .then((value) => ({ value }), (error) => ({ error }));
    await waitForLock(pid);
    block += 1; clock = block * GOODS_MARKET.BLOCK_MS + 60_000;
    await holder.query('COMMIT');
    const outcome = await pending;
    assert.equal(outcome.error?.code, 'price_changed');
    await waiter.query('ROLLBACK');
    assert.deepEqual(await snapshot(), beforeStale, 'expired waiter did not consume old-block quota');
    await transact('buy', 500);
    assert.deepEqual(await snapshot(), { price_block: block, bought: 500, sold: 0 });
    log('request crossing the price boundary during a PostgreSQL lock wait is rejected');
  } finally {
    await holder.query('ROLLBACK'); await waiter.query('ROLLBACK');
    holder.release(); waiter.release();
  }

  await clear();
  const inserter = await pool.connect(), firstTouchWaiter = await pool.connect();
  try {
    await inserter.query('BEGIN');
    await firstTouchWaiter.query('BEGIN');
    await consumeGoodsLiquidity(inserter, 'gin', 'docks', 'buy', 430, block);
    const pid = (await firstTouchWaiter.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const pending = consumeGoodsLiquidity(firstTouchWaiter, 'gin', 'docks', 'buy', 70, block)
      .then((value) => ({ value }), (error) => ({ error }));
    await waitForLock(pid);
    const oldBlock = block;
    block += 1; clock = block * GOODS_MARKET.BLOCK_MS + 60_000;
    await inserter.query('COMMIT');
    const outcome = await pending;
    assert.equal(outcome.error?.code, 'price_changed');
    await firstTouchWaiter.query('ROLLBACK');
    assert.deepEqual(await snapshot(), { price_block: oldBlock, bought: 430, sold: 0 });
    await transact('buy', 500);
    assert.deepEqual(await snapshot(), { price_block: block, bought: 500, sold: 0 });
    log('first-touch request crossing the price boundary while awaiting insertion is rejected');
  } finally {
    await inserter.query('ROLLBACK'); await firstTouchWaiter.query('ROLLBACK');
    inserter.release(); firstTouchWaiter.release();
  }

  if (process.env.GOODS_MARKET_TEST_EVIDENCE) {
    const hashes = Object.fromEntries(['src/goodsmarket.js', 'test/goods-market-postgres.js'].map((file) => [file,
      crypto.createHash('sha256').update(fs.readFileSync(new URL('../' + file, import.meta.url))).digest('hex')]));
    hashes['schema.sql:goods_market_liquidity'] = crypto.createHash('sha256').update(table).digest('hex');
    fs.writeFileSync(process.env.GOODS_MARKET_TEST_EVIDENCE, JSON.stringify({
      phase: 'local fix verification; not deployed', utc: new Date(realNow()).toISOString(),
      serverVersion: version, nodeVersion: process.version, hashes, passed: evidence,
    }, null, 2) + '\n');
  }
  console.log(`Goods market PostgreSQL: ${evidence.length} proofs passed`);
} finally {
  Date.now = realNow;
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`);
  await admin.end();
}
