// Native transaction evidence. Never uses DATABASE_URL or an existing schema.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { solveTaskPuzzle } from './task-puzzle-solver.js';

export function taskPuzzlePostgresTarget(raw) {
  if (!raw) throw new Error('Set TASK_PUZZLE_TEST_DATABASE_URL to a disposable loopback omerta_task_puzzles* PostgreSQL database.');
  let endpoint;
  try { endpoint = new URL(raw); } catch { throw new Error('Invalid TASK_PUZZLE_TEST_DATABASE_URL.'); }
  if (!['postgres:', 'postgresql:'].includes(endpoint.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname) ||
    !/^\/omerta_task_puzzles[a-z0-9_]*$/i.test(endpoint.pathname) || endpoint.pathname.length > 64 || endpoint.search || endpoint.hash)
    throw new Error('Use only a disposable loopback omerta_task_puzzles* database, without URL option overrides.');
  return endpoint;
}

export async function runTaskPuzzlePostgres(raw = process.env.TASK_PUZZLE_TEST_DATABASE_URL) {
  const endpoint = taskPuzzlePostgresTarget(raw);
  const { Pool } = await import('pg');
  const { dbCaps, migrateSchemaUnderLock } = await import('../src/db.js');
  const { withCharacter, doCrime } = await import('../src/game.js');
  const { doMission } = await import('../src/growth.js');
  const { advanceHustle } = await import('../src/hustle.js');
  const { jobTaskPuzzle } = await import('../src/task-puzzle-jobs.js');
  const { dayOf, hustleOf } = await import('../src/rules.js');
  const schema = `task_puzzles_native_${crypto.randomBytes(8).toString('hex')}`;
  assert.match(schema, /^task_puzzles_native_[a-f0-9]{16}$/);
  const connection = { host: endpoint.hostname === '[::1]' ? '::1' : '127.0.0.1', port: Number(endpoint.port || 5432),
    database: endpoint.pathname.slice(1), user: decodeURIComponent(endpoint.username),
    ...(endpoint.password ? { password: decodeURIComponent(endpoint.password) } : {}), ssl: false, connectionTimeoutMillis: 5000 };
  const admin = new Pool({ ...connection, max: 1 });
  const scoped = { ...connection, max: 3, options: `-c search_path=${schema} -c statement_timeout=120000 -c lock_timeout=15000 -c idle_in_transaction_session_timeout=30000` };
  const pool = new Pool(scoped), peer = new Pool(scoped), caps = { ...dbCaps };
  let created = false, failure;
  const as = (who, fn, db = pool) => withCharacter(db, who.account, fn);
  const issue = (who, scope, targetId, db = pool) => as(who, (ch, c) => jobTaskPuzzle(ch, { scope, targetId }, c, true), db);
  const reject = (fn, code) => assert.rejects(fn, error => error.code === code);
  const oneWinner = (results, code) => {
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1, JSON.stringify(results));
    assert.equal(results.filter(r => r.status === 'rejected' && r.reason.code === code).length, 1);
  };
  const identity = async name => {
    const account = crypto.randomUUID(), id = crypto.randomUUID();
    await pool.query('INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,$2,$3)', [account, 'task-puzzle-native', account]);
    await pool.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [account]);
    await pool.query('INSERT INTO characters (id,account_id,name,season,respect,cunning,cash,nerve) VALUES ($1,$2,$3,1,10000,100,50000,30)', [id, account, name]);
    return { account, id };
  };
  const count = async (sql, args) => Number((await pool.query(sql, args)).rows[0].n);
  try {
    const proof = await admin.connect();
    let server;
    try {
      assert(['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(proof.connection.stream.remoteAddress));
      server = (await proof.query('SELECT current_database() AS database,version() AS version')).rows[0];
    } finally { proof.release(); }
    assert.equal(server.database, connection.database); assert.match(server.version, /PostgreSQL/);
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    const boot = await pool.connect();
    try {
      assert.equal((await boot.query('SHOW search_path')).rows[0].search_path, schema);
      await boot.query('SELECT pg_advisory_lock(hashtext($1))', [schema]);
      await migrateSchemaUnderLock(boot, { schemaText: fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'), compatibility: 'postgres' });
    } finally { await boot.query('SELECT pg_advisory_unlock(hashtext($1))', [schema]); boot.release(); }
    Object.assign(dbCaps, { skipLocked: true, indexedTextArrayAny: true, timestampText: true });
    const aPid = (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const bPid = (await peer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    assert.notEqual(aPid, bPid);
    console.log(JSON.stringify({ nativePostgres: true, database: connection.database, schema, backendPids: [aPid, bPid] }));
    const a = await identity('Native Puzzle Jobs');
    const issued = await Promise.all([issue(a, 'mission', 'm2'), issue(a, 'mission', 'm2', peer)]);
    assert.deepEqual(issued[0].puzzle, issued[1].puzzle);
    assert.equal(await count('SELECT COUNT(*) AS n FROM task_puzzles WHERE character_id=$1', [a.id]), 1);
    const submission = solveTaskPuzzle(issued[0].puzzle);
    await reject(as(a, (ch, c, h) => doMission(ch, 'm2', c, h)), 'task_puzzle_required');
    await reject(as(a, (ch, c, h) => doMission(ch, 'm2', c, h, { id: submission.id, answer: {} })), 'bad_task_puzzle_answer');
    // Throw after consumption, completion and payout writes, before the outer commit.
    await assert.rejects(as(a, async (ch, c, h) => {
      const result = await doMission(ch, 'm2', c, h, submission);
      assert.equal(result.puzzle.completed, true); throw new Error('forced rollback after mission');
    }), /forced rollback after mission/);
    assert.equal((await pool.query('SELECT consumed_at FROM task_puzzles WHERE id=$1', [submission.id])).rows[0].consumed_at, null);
    assert.equal(await count('SELECT COUNT(*) AS n FROM missions_done WHERE character_id=$1', [a.id]), 0);
    assert.equal(await count("SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1 AND reason='mission:m2'", [a.id]), 0);
    assert.equal(Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [a.id])).rows[0].cash), 50000);
    oneWinner(await Promise.allSettled([
      as(a, (ch, c, h) => doMission(ch, 'm2', c, h, submission)),
      as(a, (ch, c, h) => doMission(ch, 'm2', c, h, submission), peer),
    ]), 'done');
    assert.equal(await count("SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1 AND reason='mission:m2'", [a.id]), 1);
    assert.equal(Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [a.id])).rows[0].cash), 53500);
    await reject(as(a, (ch, c, h) => doMission(ch, 'm2', c, h, submission)), 'done');
    console.log('PASS native concurrent issuance, required mission completion/replay and atomic payout rollback');

    const today = dayOf(), hustle = hustleOf(a.id, today);
    await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [a.id, hustle.stops[0]]);
    await as(a, (ch, c, h) => advanceHustle(ch, c, h));
    const hp = solveTaskPuzzle((await issue(a, 'hustle', 'legwork')).puzzle);
    await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [a.id, hustle.stops[1]]);
    await reject(as(a, (ch, c, h) => advanceHustle(ch, c, h, hp)), 'legwork');
    await pool.query('INSERT INTO daily_progress (character_id,day,counters) VALUES ($1,$2,$3) ON CONFLICT (character_id,day) DO UPDATE SET counters=$3', [a.id, today, JSON.stringify({ [hustle.leg.kind]: 1 })]);
    await assert.rejects(as(a, async (ch, c, h) => { await advanceHustle(ch, c, h, hp); throw new Error('forced hustle rollback'); }), /forced hustle rollback/);
    assert.equal((await pool.query('SELECT consumed_at FROM task_puzzles WHERE id=$1', [hp.id])).rows[0].consumed_at, null);
    assert.equal((await pool.query('SELECT step FROM hustles WHERE character_id=$1 AND day=$2', [a.id, today])).rows[0].step, 1);
    oneWinner(await Promise.allSettled([
      as(a, (ch, c, h) => advanceHustle(ch, c, h, hp)), as(a, (ch, c, h) => advanceHustle(ch, c, h, hp), peer),
    ]), 'district');
    console.log('PASS native Hustle legwork preservation, simultaneous check-ins and consumption rollback');

    const b = await identity('Native Crime Prep'), prep = solveTaskPuzzle((await issue(b, 'crime', 'pick')).puzzle);
    const random = Math.random;
    try {
      Math.random = () => 0.999999;
      await assert.rejects(as(b, async (ch, c, h) => { await doCrime(ch, 'pick', c, h, 'standard', prep); throw new Error('forced crime rollback'); }), /forced crime rollback/);
      const row = (await pool.query('SELECT crime_puzzle_revision,nerve,street_action_at FROM characters WHERE id=$1', [b.id])).rows[0];
      assert.equal(String(row.crime_puzzle_revision), '0'); assert.equal(Number(row.nerve), 30); assert.equal(row.street_action_at, null);
      assert.equal((await pool.query('SELECT consumed_at FROM task_puzzles WHERE id=$1', [prep.id])).rows[0].consumed_at, null);
      const result = await as(b, (ch, c, h) => doCrime(ch, 'pick', c, h, 'standard', prep));
      assert.equal(result.success, false); assert.equal(result.puzzle.completed, true);
      await pool.query('UPDATE characters SET street_action_at=NULL,jail_until=NULL WHERE id=$1', [b.id]);
      await reject(as(b, (ch, c, h) => doCrime(ch, 'pick', c, h, 'standard', prep)), 'stale_task_puzzle');
      // Pruning audit history cannot rewind the durable revision or revive old prep.
      await pool.query('DELETE FROM rng_audit WHERE character_id=$1', [b.id]);
      await reject(as(b, (ch, c, h) => doCrime(ch, 'pick', c, h, 'standard', prep)), 'stale_task_puzzle');
      const next = (await issue(b, 'crime', 'pick')).puzzle; assert.notEqual(next.id, prep.id);
      await as(b, (ch, c, h) => doCrime(ch, 'stereo', c, h));
      await pool.query('UPDATE characters SET street_action_at=NULL,jail_until=NULL WHERE id=$1', [b.id]);
      await reject(as(b, (ch, c, h) => doCrime(ch, 'pick', c, h, 'standard', solveTaskPuzzle(next))), 'stale_task_puzzle');
    } finally { Math.random = random; }
    console.log('PASS native optional prep rollback, failed/cross-crime invalidation and audit-pruning independence');

    const old = solveTaskPuzzle((await issue(b, 'mission', 'm11')).puzzle);
    await pool.query('UPDATE characters SET alive=false WHERE id=$1', [b.id]);
    const heirId = crypto.randomUUID();
    await pool.query('INSERT INTO characters (id,account_id,name,season,respect,cunning) VALUES ($1,$2,$3,1,10000,100)', [heirId, b.account, 'Native Puzzle Heir']);
    await reject(as(b, (ch, c, h) => doMission(ch, 'm11', c, h, old)), 'stale_task_puzzle');
    console.log('PASS native old-character answer refusal; task-puzzle PostgreSQL proof complete');
    return { passed: true, nativePostgres: true };
  } catch (error) { failure = error; throw error; }
  finally {
    Object.assign(dbCaps, caps); await Promise.all([pool.end(), peer.end()]);
    try {
      if (created) {
        // Bounded table drops avoid accumulating hundreds of relation locks.
        const tables = (await admin.query('SELECT tablename FROM pg_tables WHERE schemaname=$1', [schema])).rows;
        for (const { tablename } of tables) await admin.query(`DROP TABLE IF EXISTS "${schema}"."${tablename.replaceAll('"', '""')}" CASCADE`);
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
        assert.equal((await admin.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema])).rowCount, 0);
        console.log('PASS isolated native schema removed');
      }
    } catch (error) { if (!failure) throw error; console.error('Native cleanup also failed:', error.message); }
    finally { await admin.end(); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runTaskPuzzlePostgres(); }
  catch (error) { console.error(error.stack || error); process.exitCode = 1; }
}
