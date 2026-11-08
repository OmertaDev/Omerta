// Real PostgreSQL lock/transaction proofs; explicit disposable loopback database only.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { Pool } from 'pg';
import { checkpointCasinoRakeback, casinoRakebackClaim } from '../src/casinorakeback.js';
import { migrateColumns } from '../src/db.js';

assert(process.env.CASINO_RAKEBACK_TEST_DATABASE_URL, 'Explicit CASINO_RAKEBACK_TEST_DATABASE_URL required');
const endpoint = new URL(process.env.CASINO_RAKEBACK_TEST_DATABASE_URL);
assert(['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname));
assert(endpoint.port && endpoint.port !== '5432');
assert(/^\/omerta_economy_review(?:_[a-z0-9]+)?$/.test(endpoint.pathname));
const namespace = 'casino_rakeback_test_' + crypto.randomBytes(8).toString('hex');
const admin = new Pool({ connectionString:endpoint.href,max:2 });
const pool = new Pool({ connectionString:endpoint.href,max:6,
  options:`-c search_path=${namespace} -c lock_timeout=10000 -c statement_timeout=10000` });
const schema = fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8');
const tables = ['businesses','den_volume'].map((name) => schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${name}\\s*\\([\\s\\S]*?\\n\\);`))?.[0]);
assert(tables.every(Boolean));
const cases = [];
const tx = async (fn) => {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result=await fn(client); await client.query('COMMIT'); return result; }
  catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};
const reset = async () => {
  await pool.query('DELETE FROM businesses');
  await pool.query("UPDATE den_volume SET total=0,profit=1000000000,distributed=0,rake_index='0',rake_checkpoint_volume=NULL,rake_legacy_owners=0 WHERE id=1");
};
const addOwner = async (client,id) => {
  const state=await checkpointCasinoRakeback(client);
  await client.query("INSERT INTO businesses (id,character_id,kind,rake_cursor,rake_index_cursor) VALUES ($1,$1,'casino',$2,$3)",[id,state.volume,state.index]);
  return state;
};
const claim = async (client,id) => {
  const front=(await client.query('SELECT * FROM businesses WHERE id=$1 FOR UPDATE',[id])).rows[0];
  const state=await checkpointCasinoRakeback(client);
  const result=casinoRakebackClaim(front,state);
  await client.query('UPDATE businesses SET rake_index_cursor=$2 WHERE id=$1',[id,result.paidCursor]);
  return result.amount;
};
const waitForLock = async (pid) => {
  const deadline=Date.now()+5000;
  while(Date.now()<deadline) {
    if((await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock') return;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.fail(`Backend ${pid} did not enter an observed PostgreSQL lock wait`);
};
try {
  await admin.query(`CREATE SCHEMA ${namespace}`);
  // Exercise the actual additive column migrator against legacy table shapes, twice.
  await pool.query('CREATE TABLE businesses (id TEXT PRIMARY KEY,character_id TEXT NOT NULL,kind TEXT NOT NULL,tier INT NOT NULL DEFAULT 1,rake_cursor NUMERIC NOT NULL DEFAULT 0)');
  await pool.query('CREATE TABLE den_volume (id INT PRIMARY KEY,total NUMERIC NOT NULL DEFAULT 0,profit NUMERIC NOT NULL DEFAULT 0,distributed NUMERIC NOT NULL DEFAULT 0)');
  const first=await migrateColumns(pool,tables.join('\n'));
  assert.equal(first.failed,0);
  assert.equal((await migrateColumns(pool,tables.join('\n'))).failed,0);
  await pool.query('INSERT INTO den_volume (id,total) VALUES (1,1000000)');
  await pool.query("INSERT INTO businesses (id,character_id,kind,rake_cursor) VALUES ('a','a','casino',0),('b','b','casino',500000)");
  await tx(client=>addOwner(client,'c'));
  assert.equal(await tx(client=>claim(client,'a')),5000);
  assert.equal(await tx(client=>claim(client,'b')),2500);
  assert.equal(await tx(client=>claim(client,'c')),0);
  cases.push('additive schema migration is idempotent; first checkpoint preserves legacy snapshot before new owner');

  await reset(); await tx(client=>addOwner(client,'a'));
  await pool.query('UPDATE den_volume SET total=1000000 WHERE id=1');
  const holder=await pool.connect(), waiter=await pool.connect();
  try {
    await holder.query('BEGIN'); await waiter.query('BEGIN');
    const held=await checkpointCasinoRakeback(holder);
    const pid=Number((await waiter.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    const pending=addOwner(waiter,'b');
    await waitForLock(pid);
    // Owner B cannot change the denominator while the earlier interval is checkpointing.
    assert.equal(held.index,'10000');
    await holder.query('COMMIT');
    await pending; await waiter.query('COMMIT');
  } finally { await holder.query('ROLLBACK');await waiter.query('ROLLBACK');holder.release();waiter.release(); }
  assert.deepEqual((await Promise.all([tx(client=>claim(client,'a')),tx(client=>claim(client,'a'))])).sort((a,b)=>a-b),[0,10000]);
  assert.equal(await tx(client=>claim(client,'b')),0);
  cases.push('observed owner-join lock wait preserves solo earnings; concurrent duplicate claims pay once');

  // A bet waiting behind a membership change belongs to the new membership interval.
  const joining=await pool.connect(), betting=await pool.connect();
  try {
    await joining.query('BEGIN');await betting.query('BEGIN');
    await addOwner(joining,'c');
    const pid=Number((await betting.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    const pending=betting.query('UPDATE den_volume SET total=total+900 WHERE id=1');
    await waitForLock(pid);
    await joining.query('COMMIT');await pending;await betting.query('COMMIT');
  } finally { await joining.query('ROLLBACK');await betting.query('ROLLBACK');joining.release();betting.release(); }
  const concurrent=await Promise.all(['a','b','c'].map(id=>tx(client=>claim(client,id))));
  assert.deepEqual(concurrent,[3,3,3]);
  cases.push('observed bet lock wait plus concurrent claims allocate new volume to three current owners exactly once');

  await pool.query('UPDATE den_volume SET total=total+900 WHERE id=1');
  await assert.rejects(tx(async client=>{await checkpointCasinoRakeback(client);await client.query("DELETE FROM businesses WHERE id='c'");throw new Error('injected abort');}),/injected abort/);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM businesses')).rows[0].n),3);
  assert.deepEqual(await Promise.all(['a','b','c'].map(id=>tx(client=>claim(client,id)))),[3,3,3]);
  cases.push('aborted ownership transition rolls back index and membership together');

  await pool.query('UPDATE den_volume SET total=total+900 WHERE id=1');
  const leaving=await pool.connect(), survivor=await pool.connect();
  try {
    await leaving.query('BEGIN');await survivor.query('BEGIN');
    await checkpointCasinoRakeback(leaving);
    const pid=Number((await survivor.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    const pending=claim(survivor,'b');
    await waitForLock(pid);
    await leaving.query("DELETE FROM businesses WHERE id='c'");
    await leaving.query('COMMIT');
    assert.equal(await pending,3);await survivor.query('COMMIT');
  } finally {await leaving.query('ROLLBACK');await survivor.query('ROLLBACK');leaving.release();survivor.release();}
  assert.equal(await tx(client=>claim(client,'a')),3);
  cases.push('observed departure-vs-claim lock wait preserves the old three-owner interval');
  console.log(JSON.stringify({passed:true,postgres:(await pool.query('SHOW server_version')).rows[0].server_version,cases},null,2));
} finally {
  await pool.end();
  assert(/^casino_rakeback_test_[a-f0-9]{16}$/.test(namespace));
  await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`);
  await admin.end();
}
