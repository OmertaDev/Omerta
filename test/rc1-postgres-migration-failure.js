// RC1 production database gate: a real DDL failure must prevent a success stamp.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { migrateSchemaUnderLock } from '../src/db.js';

const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(endpoint.hostname), 'Explicit isolated PostgreSQL required');
const namespace = `rc1_migration_${crypto.randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: endpoint.toString() });
await admin.query(`CREATE SCHEMA ${namespace}`);
const pool = new pg.Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace}` });
const boot = await pool.connect();
try {
  await boot.query('SELECT pg_advisory_lock(918273645)');
  await migrateSchemaUnderLock(boot);
  await boot.query("UPDATE schema_meta SET app_version='0.0.0',schema_sha='rc1-before-fault' WHERE id=1");
  await boot.query('ALTER TABLE characters DROP COLUMN bank_credit_ms');
  await boot.query(`CREATE FUNCTION ${namespace}.reject_column() RETURNS event_trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF current_schema() = '${namespace}' AND current_query() ILIKE '%ADD COLUMN IF NOT EXISTS bank_credit_ms %' THEN
        RAISE EXCEPTION 'RC1 injected DDL interruption' USING ERRCODE='57014';
      END IF;
    END $$`);
  await boot.query(`CREATE EVENT TRIGGER ${namespace}_fault ON ddl_command_start EXECUTE FUNCTION ${namespace}.reject_column()`);
  let failure, result;
  try { result = await migrateSchemaUnderLock(boot); } catch (error) { failure = error; }
  const stamp = (await boot.query('SELECT app_version,schema_sha FROM schema_meta WHERE id=1')).rows[0];
  console.log(JSON.stringify({ faultObserved: !!failure, result, stamp }));
  assert(failure, 'A partial column migration must refuse startup instead of stamping success');
  assert.equal(failure.code, 'schema_migration_incomplete');
  assert.deepEqual(stamp, { app_version: '0.0.0', schema_sha: 'rc1-before-fault' });
  await boot.query(`DROP EVENT TRIGGER ${namespace}_fault`);
  const retried = await migrateSchemaUnderLock(boot);
  assert.equal(retried.migration.failed, 0);
  assert.equal((await boot.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='characters' AND column_name='bank_credit_ms'")).rows.length, 1);
  const reapplied = await migrateSchemaUnderLock(boot);
  assert.equal(reapplied.migration.failed, 0);
  assert.equal((await boot.query('SELECT schema_sha FROM schema_meta WHERE id=1')).rows[0].schema_sha, retried.stamp.sha);
  console.log('RC1: real DDL interruption refuses startup/stamp; retry and restart migration succeed');
} finally {
  await boot.query(`DROP EVENT TRIGGER IF EXISTS ${namespace}_fault`);
  await boot.query('SELECT pg_advisory_unlock(918273645)');
  boot.release(); await pool.end();
  await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end();
}
