// RC1 production database gate: a real DDL failure must prevent a success stamp.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import { migrateSchemaUnderLock } from '../src/db.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Set COORDINATION_TEST_DATABASE_URL to a disposable loopback PostgreSQL database');
const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(endpoint.hostname), 'Explicit isolated PostgreSQL required');
const namespace = `rc1_migration_${crypto.randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: endpoint.toString() });
await admin.query(`CREATE SCHEMA ${namespace}`);
const pool = new pg.Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace}` });
const boot = await pool.connect();
try {
  await boot.query('SELECT pg_advisory_lock(918273645)');
  await boot.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  await boot.query('CREATE TABLE player_reset_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  await boot.query("INSERT INTO player_reset_migrations (id,applied_at) VALUES ('starting-levels-2026-10-06','2026-10-06T00:00:00Z')");
  const oldMarker = (await boot.query('SELECT * FROM player_reset_migrations')).rows[0];
  for (const [id, alive, npc] of [['reset-human', true, false], ['reset-human-two', true, false],
    ['reset-dead', false, false], ['reset-npc', true, true], ['reset-dead-npc', false, true]]) {
    await boot.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES ($1,'reset-test',$1)", [id]);
    await boot.query('INSERT INTO characters (id,account_id,name,season,respect,cash,alive,is_npc) VALUES ($1,$1,$1,1,12345,9876,$2,$3)', [id, alive, npc]);
  }
  const beforeReset = (await boot.query('SELECT * FROM characters ORDER BY id')).rows;
  await boot.query(`CREATE FUNCTION ${namespace}.reject_reset_marker() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.id = 'starting-levels-2026-10-14' THEN
        RAISE EXCEPTION 'Injected reset marker failure' USING ERRCODE='P0001';
      END IF;
      RETURN NEW;
    END $$`);
  await boot.query(`CREATE TRIGGER reset_marker_fault BEFORE INSERT ON player_reset_migrations
    FOR EACH ROW EXECUTE FUNCTION ${namespace}.reject_reset_marker()`);
  await assert.rejects(migrateSchemaUnderLock(boot), error => error.code === 'P0001');
  assert.deepEqual((await boot.query('SELECT * FROM characters ORDER BY id')).rows, beforeReset,
    'a failed marker insert rolls back every respect update');
  assert.deepEqual((await boot.query('SELECT * FROM player_reset_migrations')).rows, [oldMarker],
    'a failed reset preserves the historical marker and records no successful reset');
  await boot.query('DROP TRIGGER reset_marker_fault ON player_reset_migrations');
  await boot.query(`DROP FUNCTION ${namespace}.reject_reset_marker()`);
  await migrateSchemaUnderLock(boot);
  const afterReset = (await boot.query('SELECT * FROM characters ORDER BY id')).rows;
  for (const row of afterReset) {
    const original = beforeReset.find(value => value.id === row.id);
    if (row.alive && !row.is_npc) {
      assert.equal(Number(row.respect), 0, 'living humans receive the new reset despite the October 6 marker');
      assert.deepEqual({ ...row, respect: original.respect }, original, 'all other human fields, including cash, remain unchanged');
    } else assert.deepEqual(row, original, 'dead characters and NPCs remain byte-equivalent as decoded rows');
  }
  const resetMarkers = (await boot.query('SELECT * FROM player_reset_migrations ORDER BY id')).rows;
  assert.equal(resetMarkers.length, 2);
  assert.deepEqual(resetMarkers[0], oldMarker);
  assert.equal(resetMarkers[1].id, 'starting-levels-2026-10-14');
  await boot.query("UPDATE characters SET respect=4321 WHERE id='reset-human'");
  const progressed = (await boot.query('SELECT * FROM characters ORDER BY id')).rows;
  await migrateSchemaUnderLock(boot);
  assert.deepEqual((await boot.query('SELECT * FROM characters ORDER BY id')).rows, progressed,
    'a second boot preserves all newly earned progress and every other field');
  assert.deepEqual((await boot.query('SELECT * FROM player_reset_migrations ORDER BY id')).rows, resetMarkers);
  console.log('October 14 respect reset: old-marker upgrade, human-only mutation, exact cash/dead/NPC preservation, atomic rollback and boot replay passed');
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
