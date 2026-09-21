import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import fs from 'node:fs';
import { createNativeCommitObserver, assertSingleSqlStatement } from '../tools/rc1-native-commit-observer.js';
import { installSerialRuntime, serialDatabaseOptions } from '../tools/rc1-native-determinism.js';

let called = false;
const guard = createNativeCommitObserver({ onBoundary: async () => {} }); guard.arm();
const guarded = guard.wrapQuery({}, async () => { called = true; });
await assert.rejects(guarded('BEGIN; COMMIT'), /one statement/);
assert.equal(called, false, 'Ambiguous intermediate commits must be rejected before SQL executes');
assert.throws(() => guard.assertComplete(), /one statement/);
console.log('PASS: ambiguous SQL fails before execution and remains a recorded observer failure');
for (const sql of ["SELECT ';'", 'SELECT ";"', "SELECT 'can''t; split'; -- trailing; comment", '/* nested /* ; */ comment; */ SELECT 1;',
  'SELECT $$one; two$$;', 'SELECT $tag$one; \'two\'$tag$', String.raw`SELECT E'can\'t; split'`, 'SELECT $1::text'])
  assert.doesNotThrow(() => assertSingleSqlStatement(sql));
for (const sql of ['SELECT 1; COMMIT', 'SELECT 1;;', "SELECT 'unfinished", 'SELECT "unfinished', 'SELECT $$unfinished',
  'SELECT /* unfinished', '/* only a comment */', String.raw`SELECT 'ambiguous\'`, 'SELECT U&\'escape\'', 'SELECT $unsupported'])
  assert.throws(() => assertSingleSqlStatement(sql));
const canonicalSource = fs.readFileSync(new URL('../src/game.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const canonicalReadSql = canonicalSource.match(/const bulk = await client\.query\(`([\s\S]*?)`,\n  \[ch\.id, ch\.account_id, today\]\)/)?.[1];
assert(canonicalReadSql?.includes('free lookup;')); assert.doesNotThrow(() => assertSingleSqlStatement(canonicalReadSql));
console.log(JSON.stringify({ lexicalGuard: 'PASS', canonicalReadSqlSha256: crypto.createHash('sha256').update(canonicalReadSql).digest('hex') }));

if (process.argv.includes('--postgres')) {
  const url = process.env.COORDINATION_TEST_DATABASE_URL;
  assert(url && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname));
  const schema = `rc1_commit_observer_${crypto.randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool({ connectionString: url });
  const runtime = installSerialRuntime('commit-observer-control');
  let pool, reader, client;
  const events = [], attempts = []; let failObserver = false;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    reader = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    const observer = createNativeCommitObserver({
      async onAttempt(event) { attempts.push(event); },
      async onBoundary(event) {
        const balance = (await reader.query('SELECT amount::text FROM balance WHERE id=1')).rows[0].amount;
        events.push({ ...event, balance });
        if (failObserver) throw Error('injected observer failure after durable commit');
      },
    });
    const options = serialDatabaseOptions({ commitObserver: observer });
    pool = options.poolFactory({ connectionString: url, options: `-c search_path=${schema}` }, schema);
    await options.initialize(pool);
    await pool.query('CREATE TABLE balance(id int PRIMARY KEY,amount numeric NOT NULL)');
    await pool.query('INSERT INTO balance VALUES(1,0)');
    client = await pool.connect(); observer.arm();
    await client.query('BEGIN'); await client.query('UPDATE balance SET amount=11'); await client.query('COMMIT');
    assert.equal(events.at(-1).balance, '11'); assert.equal(events.at(-1).outcome, 'COMMITTED');
    await client.query('BEGIN'); await client.query('UPDATE balance SET amount=20');
    await assert.rejects(client.query('INSERT INTO balance VALUES(1,99)'), { code: '23505' });
    await client.query('COMMIT');
    assert.equal(events.at(-1).outcome, 'ROLLED_BACK'); assert.equal(events.at(-1).balance, '11');
    await client.query('BEGIN'); await client.query('UPDATE balance SET amount=12'); await client.query('SAVEPOINT retained');
    await client.query('UPDATE balance SET amount=99'); await client.query('ROLLBACK TO retained'); await client.query('COMMIT');
    assert.equal(events.at(-1).balance, '12');
    await client.query('UPDATE balance SET amount=13');
    assert.equal(events.at(-1).outcome, 'AUTOCOMMITTED'); assert.equal(events.at(-1).balance, '13');
    await assert.rejects(client.query('INSERT INTO balance VALUES(1,99)'), { code: '23505' });
    assert.equal(events.at(-1).outcome, 'STATEMENT_ABORTED'); assert.equal(events.at(-1).balance, '13');
    observer.assertComplete();
    assert(attempts.some((event) => event.outcome === 'THREW' && event.code === '23505'));
    // Borrow both real connections before launching; connection establishment
    // itself may otherwise outlast the first query and remove the overlap.
    const second = await pool.connect();
    try {
      const pending = client.query('SELECT pg_sleep(0.1)');
      await assert.rejects(second.query('UPDATE balance SET amount=99'), /Concurrent native queries/);
      await pending;
    } finally { second.release(); }
    assert.equal((await reader.query('SELECT amount::text FROM balance')).rows[0].amount, '13');
    assert.throws(() => observer.assertComplete(), /Concurrent native queries/);
    await client.query("SELECT ';'::text AS quoted /* outer; /* inner; */ comment */; -- trailing; comment");
    await client.query(String.raw`SELECT E'can\'t; split'::text AS escaped, $tag$literal; semicolon$tag$::text AS dollar`);
    await assert.rejects(client.query('UPDATE balance SET amount=999; COMMIT; UPDATE balance SET amount=888'), /one statement/);
    await assert.rejects(client.query('DO $$BEGIN UPDATE balance SET amount=777; COMMIT; END$$'), /hide intermediate commits/);
    assert.equal((await reader.query('SELECT amount::text FROM balance')).rows[0].amount, '13', 'True multiple statements rejected before any mutation');
    failObserver = true;
    await assert.rejects(client.query('UPDATE balance SET amount=14'), /after durable commit/);
    assert.equal((await reader.query('SELECT amount::text FROM balance')).rows[0].amount, '14');
    assert.throws(() => observer.assertComplete(), /after durable commit/);
    observer.disarm();
    console.log(JSON.stringify({ status: 'PASS_SCOPED', retainedBoundaries: events.length,
      nativeAbortedCommit: true, savepointRollback: true, autocommit: true,
      concurrentQueryRefusedBeforeMutation: true, failedObserverKeepsCommittedValue: true }));
  } finally {
    client?.release(); await pool?.end(); await reader?.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); runtime.restore();
  }
}
