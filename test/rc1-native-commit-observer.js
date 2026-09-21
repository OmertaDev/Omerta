import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { createNativeCommitObserver } from '../tools/rc1-native-commit-observer.js';
import { installSerialRuntime, serialDatabaseOptions } from '../tools/rc1-native-determinism.js';

let called = false;
const guard = createNativeCommitObserver({ onBoundary: async () => {} }); guard.arm();
const guarded = guard.wrapQuery({}, async () => { called = true; });
await assert.rejects(guarded('BEGIN; COMMIT'), /one statement/);
assert.equal(called, false, 'Ambiguous intermediate commits must be rejected before SQL executes');
assert.throws(() => guard.assertComplete(), /one statement/);
console.log('PASS: ambiguous SQL fails before execution and remains a recorded observer failure');

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
    const pending = client.query('SELECT pg_sleep(0.1)');
    await assert.rejects(pool.query('UPDATE balance SET amount=99'), /Concurrent native queries/);
    await pending;
    assert.equal((await reader.query('SELECT amount::text FROM balance')).rows[0].amount, '13');
    assert.throws(() => observer.assertComplete(), /Concurrent native queries/);
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
