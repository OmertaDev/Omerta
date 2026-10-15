import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { enforceDatabaseRls } from '../src/db-rls.js';

let calls = 0;
assert.deepEqual(await enforceDatabaseRls({ query() { calls++; } }, { compatibility: 'pg-mem' }),
  { verified: false, compatibility: 'pg-mem' });
assert.equal(calls, 0, 'pg-mem must never pretend to verify PostgreSQL security');
await assert.rejects(enforceDatabaseRls({ async query() { return { rows: [] }; } }),
  { code: 'database_rls_invalid' });
for (const field of ['enabled', 'denied', 'public_revoked', 'backend_access']) {
  const row = { relname: 'players', enabled: true, denied: true, public_revoked: true, backend_access: true };
  row[field] = false;
  await assert.rejects(enforceDatabaseRls({ async query() { return { rows: [row] }; } }),
    { code: 'database_rls_invalid' }, `fails closed when ${field} is false`);
}
console.log('db-rls: compatibility skip and fail-closed catalog checks passed');

if (process.argv.includes('--postgres')) {
  assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Set disposable COORDINATION_TEST_DATABASE_URL');
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
  assert(['localhost', '127.0.0.1'].includes(endpoint.hostname), 'Isolated loopback PostgreSQL required');
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: endpoint.toString() });
  await client.connect();
  const suffix = crypto.randomBytes(8).toString('hex');
  const schema = `rls_test_${suffix}`, role = `rls_client_${suffix}`;
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path=${schema}`);
    await client.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
    await client.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
    await client.query('CREATE TABLE players (id integer PRIMARY KEY, private_email text)');
    await client.query("INSERT INTO players VALUES (1,'private@example.test')");
    await client.query('GRANT ALL ON players TO PUBLIC');
    await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON players TO ${role}`);
    // Even a preexisting permissive policy must not defeat the restrictive deny.
    await client.query('CREATE POLICY legacy_read ON players FOR ALL USING (true) WITH CHECK (true)');
    assert.equal((await enforceDatabaseRls(client)).tables, 1);
    assert.equal((await client.query('SELECT * FROM players')).rows.length, 1, 'owner backend still reads');
    await client.query(`SET LOCAL ROLE ${role}`);
    assert.equal((await client.query('SELECT * FROM players')).rows.length, 0, 'granted direct client sees no rows');
    assert.equal((await client.query("UPDATE players SET private_email='stolen' RETURNING id")).rowCount, 0);
    assert.equal((await client.query('DELETE FROM players RETURNING id')).rowCount, 0);
    await client.query('SAVEPOINT denied_insert');
    await assert.rejects(client.query("INSERT INTO players VALUES (2,'injected')"), { code: '42501' });
    await client.query('ROLLBACK TO SAVEPOINT denied_insert');
    await client.query('RESET ROLE');
    await client.query('ALTER TABLE players DISABLE ROW LEVEL SECURITY');
    await client.query('CREATE TABLE later_migration_table (id serial PRIMARY KEY)');
    const restarted = await enforceDatabaseRls(client);
    assert.equal(restarted.tables, 2, 'restart protects migration-created tables too');
    await enforceDatabaseRls(client);
    assert.equal((await client.query('SELECT * FROM players')).rows[0].private_email, 'private@example.test');
    await client.query('ROLLBACK');
    console.log('db-rls: PostgreSQL owner access, direct-client denial, permissive-policy resistance, repair and idempotence passed');
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}
