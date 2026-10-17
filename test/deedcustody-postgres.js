// Native PostgreSQL: rollback, death ordering and the raw-transaction crash barrier.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import { ensureCharacterDeedLife, recordCharacterDeedDeath, listCharacterDeedOutbox,
  assertCharacterDeedActionsAvailable, characterDeedExitJobKey, requestCharacterDeedExit,
  cancelCharacterDeedExit } from '../src/deedcustody.js';

const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
assert(['localhost','127.0.0.1'].includes(endpoint.hostname), 'Disposable loopback PostgreSQL required');
const schema = `deed_custody_${crypto.randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: endpoint.toString() });
await admin.query(`CREATE SCHEMA ${schema}`);
const pool = new pg.Pool({ connectionString: endpoint.toString(), options: `-c search_path=${schema}` });
const first = await pool.connect(), second = await pool.connect();
const secondPid = (await second.query('SELECT pg_backend_pid() pid')).rows[0].pid;
const migration = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
  .match(/-- Character-life deed custody\.[\s\S]*?-- End character-life deed custody\./)[0];
async function lockWait(pid) {
  for (let i = 0; i < 200; i++) {
    if ((await admin.query("SELECT wait_event_type='Lock' blocked FROM pg_stat_activity WHERE pid=$1", [pid])).rows[0]?.blocked) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('Expected a real PostgreSQL lock wait');
}
try {
  await pool.query(`CREATE TABLE characters(id TEXT PRIMARY KEY,account_id TEXT,generation INT,alive BOOLEAN,cash INT DEFAULT 100);
    CREATE TABLE dynasty_tokens(token_id TEXT PRIMARY KEY,account_id TEXT);
    CREATE TABLE keeper_transactions(job_key TEXT PRIMARY KEY,status TEXT);`);
  await pool.query(migration); await pool.query(migration);
  await pool.query(`INSERT INTO characters(id,account_id,generation,alive) VALUES
    ('a','a',1,true),('b','b',1,true),('c','c',1,true),('a2','a',2,true),('b2','b',2,true),('c2','c',2,true)`);
  const close = (q, victim, killer, heir) => recordCharacterDeedDeath(q, { victimCharacterId: victim, killerCharacterId: killer, heirCharacterId: heir });
  await first.query('BEGIN');
  await first.query("SELECT id FROM characters WHERE id='a' FOR UPDATE");
  await first.query("UPDATE characters SET alive=false,cash=0 WHERE id='a'");
  await close(first, 'a', 'b', 'a2');
  await second.query('BEGIN');
  await second.query("SELECT id FROM characters WHERE id='c' FOR UPDATE");
  await second.query("UPDATE characters SET alive=false WHERE id='c'");
  const competing = close(second, 'c', 'b', 'c2');
  await lockWait(secondPid);
  assert.equal((await pool.query('SELECT count(*)::int n FROM character_deed_deaths')).rows[0].n, 0, 'Uncommitted deaths cannot dispatch');
  await first.query('ROLLBACK');
  assert.equal((await competing).deathSequence, '1', 'Rollback does not consume an ordinal');
  await second.query('COMMIT');
  assert.equal((await pool.query("SELECT cash FROM characters WHERE id='a'")).rows[0].cash, 100);
  await first.query('BEGIN');
  await first.query("SELECT id FROM characters WHERE id='a' FOR UPDATE");
  await first.query("UPDATE characters SET alive=false WHERE id='a'");
  await close(first, 'a', 'b', 'a2');
  await first.query('COMMIT');
  assert.deepEqual((await listCharacterDeedOutbox(pool)).map(row => [row.lifeId,row.deathSequence]), [['c','1'],['a','2']]);
  assert.equal((await pool.query("SELECT heir_life_id FROM character_deed_lives WHERE life_id='a'")).rows[0].heir_life_id, 'a2');

  const life = await ensureCharacterDeedLife(pool, 'b');
  const exit = { deed_token_id: '77', user_nonce: '0', user_issued_at: '1700000000', user_deadline: '1700000300', user_signature: '0x1234' };
  await pool.query(`INSERT INTO character_deed_exits(life_id,deed_token_id,status,requested_at,available_at,user_nonce,user_issued_at,user_deadline,user_signature)
    VALUES ('b','77','pending',now(),now(),$1,$2,$3,$4)`, [exit.user_nonce,exit.user_issued_at,exit.user_deadline,exit.user_signature]);
  // Crash after durable signed raw journal, before the exit row changes to releasing.
  const jobKey = characterDeedExitJobKey(exit, life.life_hash);
  await pool.query("INSERT INTO keeper_transactions VALUES ($1,'prepared')", [jobKey]);
  for (const state of ['prepared','submitted','mined','settled']) {
    await pool.query('UPDATE keeper_transactions SET status=$2 WHERE job_key=$1', [jobKey,state]);
    await assert.rejects(() => assertCharacterDeedActionsAvailable(pool, 'b'), { code: 'custody_exit_finalizing' });
  }
  await assert.rejects(() => requestCharacterDeedExit(pool,'b',{tokenId:'77'}), {code:'custody_exit_finalizing'});
  await assert.rejects(() => cancelCharacterDeedExit(pool,'b',{tokenId:'77'}), {code:'custody_exit_finalizing'});
  await first.query('BEGIN');
  await first.query("SELECT id FROM characters WHERE id='b' FOR UPDATE");
  await first.query("UPDATE characters SET alive=false,cash=0 WHERE id='b'");
  await assert.rejects(() => close(first, 'b', null, 'b2'), {code:'custody_exit_finalizing'});
  await first.query('ROLLBACK');
  assert.deepEqual((await pool.query("SELECT alive,cash FROM characters WHERE id='b'")).rows[0], {alive:true,cash:100}, 'Blocked death rolls back all action costs');
  await pool.query("UPDATE character_deed_exits SET status='confirmed' WHERE life_id='b'");
  await assertCharacterDeedActionsAvailable(pool,'b');
  await pool.query("UPDATE character_deed_exits SET status='pending' WHERE life_id='b'");
  await pool.query("UPDATE keeper_transactions SET status='reverted' WHERE job_key=$1", [jobKey]);
  await assertCharacterDeedActionsAvailable(pool,'b');

  // Character-first ordering allows a queued estate after a request without inversion.
  await first.query('BEGIN'); await first.query("SELECT id FROM characters WHERE id='b' FOR UPDATE");
  await second.query('BEGIN');
  const death = (async () => {
    await second.query("SELECT id FROM characters WHERE id='b' FOR UPDATE");
    await second.query("UPDATE characters SET alive=false WHERE id='b'");
    return close(second,'b',null,'b2');
  })();
  await lockWait(secondPid); await first.query('COMMIT');
  assert.equal((await death).deathSequence,'3'); await second.query('COMMIT');
  assert.equal((await pool.query("SELECT status FROM character_deed_exits WHERE life_id='b'")).rows[0].status,'cancelled');
  await pool.query(migration);
  assert.equal((await pool.query('SELECT next_death_sequence FROM character_deed_state')).rows[0].next_death_sequence,'4');
  console.log('deedcustody-postgres: PASS (atomic rollback, global ordering, exact heirs, raw-journal crash/finality barrier, immutable pending consent, real character-lock serialization)');
} finally {
  await first.query('ROLLBACK').catch(()=>{}); await second.query('ROLLBACK').catch(()=>{});
  first.release(); second.release(); await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
}
