import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import fs from 'node:fs';
import { migrateCityHomeStorage } from '../src/city-home-migration.js';
import { migrateSchemaUnderLock } from '../src/db.js';

const endpoint = new URL(process.env.CITY_HOME_TEST_DATABASE_URL);
assert(!endpoint.search && !endpoint.hash, 'Fixture URLs cannot override driver host or connection options');
assert(['postgres:','postgresql:'].includes(endpoint.protocol), 'Native PostgreSQL protocol required');
assert(['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname), 'Explicit isolated PostgreSQL required');
assert(/^\/(omerta_query|omerta_check|city_home_[a-z0-9_]+)$/.test(endpoint.pathname), 'Named disposable database required');
const namespace = 'city_home_migration_' + crypto.randomBytes(8).toString('hex');
const admin = new pg.Pool({ connectionString: endpoint.toString() });
await admin.query(`CREATE SCHEMA ${namespace}`);
const pool = new pg.Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace}` });
const client = await pool.connect();
const oldState = "CHECK (state IN ('active','escrowed','consumed'))";
const oldOwner = "CHECK ((state='active' AND owner_scope IN ('character','account')) OR (state='escrowed' AND owner_scope='operation') OR state='consumed')";
async function definition(name) {
  return (await client.query(`SELECT pg_get_constraintdef(oid,true) AS definition,convalidated
    FROM pg_constraint WHERE conrelid='item_instances'::regclass AND conname=$1`, [name])).rows[0];
}
async function refused(sql, values = []) {
  await assert.rejects(client.query(sql, values), error => error.code === '23514');
}
async function resetOld() {
  await client.query('TRUNCATE item_instances');
  await client.query(`ALTER TABLE item_instances DROP CONSTRAINT item_instance_state;
    ALTER TABLE item_instances ADD CONSTRAINT item_instance_state ${oldState};
    ALTER TABLE item_instances DROP CONSTRAINT item_instance_escrow_owner;
    ALTER TABLE item_instances ADD CONSTRAINT item_instance_escrow_owner ${oldOwner}`);
}
try {
  const provenance=(await client.query('SELECT current_schema() AS schema,version() AS version')).rows[0];
  assert.equal(provenance.schema,namespace);assert.match(provenance.version,/^PostgreSQL /);
  await client.query('SELECT pg_advisory_lock(918273645)');
  await client.query(`CREATE TABLE item_instances (id TEXT PRIMARY KEY,state TEXT NOT NULL,owner_scope TEXT NOT NULL,definition_hash TEXT,
    CONSTRAINT item_instance_state ${oldState},
    CONSTRAINT item_instance_escrow_owner ${oldOwner},
    CONSTRAINT item_instance_storage_legacy CHECK (state<>'stored' OR definition_hash IS NULL))`);
  await client.query(`INSERT INTO item_instances VALUES ('a','active','account',NULL),('c','active','character',NULL),
    ('e','escrowed','operation',NULL),('x','consumed','character',NULL)`);
  await refused("INSERT INTO item_instances VALUES ('before','stored','account',NULL)");
  const old = await definition('item_instance_state');
  assert.deepEqual(await migrateCityHomeStorage(client), { compatibility: 'postgres', verified: true, replaced: 2 });
  assert.deepEqual(await migrateCityHomeStorage(client), { compatibility: 'postgres', verified: true, replaced: 0 });
  assert.equal(Number((await client.query('SELECT count(*) n FROM item_instances')).rows[0].n), 4);
  await client.query("INSERT INTO item_instances VALUES ('stored','stored','account',NULL)");
  for (const [id,state,owner,hash] of [['badchar','stored','character',null],['badop','stored','operation',null],
    ['badexact','stored','account','a'.repeat(64)],['badactive','active','operation',null],['badescrow','escrowed','account',null],
    ['badstate','invented','account',null]]) {
    await refused('INSERT INTO item_instances VALUES ($1,$2,$3,$4)', [id,state,owner,hash]);
  }
  await resetOld();
  let injected = false;
  const fault = { query: async (sql, values) => {
    if (sql === 'ALTER TABLE item_instances VALIDATE CONSTRAINT item_instance_escrow_owner') {
      injected = true; throw new Error('Controlled late custody migration interruption');
    }
    return client.query(sql, values);
  } };
  await assert.rejects(migrateCityHomeStorage(fault), /Controlled late/);
  assert(injected);
  assert.deepEqual(await definition('item_instance_state'), old, 'Earlier DDL rolled back after late failure');
  await refused("INSERT INTO item_instances VALUES ('afterfault','stored','account',NULL)");
  assert.equal((await migrateCityHomeStorage(client)).replaced, 2);
  await resetOld();
  await client.query(`ALTER TABLE item_instances DROP CONSTRAINT item_instance_escrow_owner;
    ALTER TABLE item_instances ADD CONSTRAINT item_instance_escrow_owner CHECK (true)`);
  await assert.rejects(migrateCityHomeStorage(client), error => error.code === 'city_home_storage_migration_invalid');
  assert.deepEqual(await definition('item_instance_state'), old, 'Unknown sibling predicate aborts all earlier changes');
  await resetOld();
  await client.query(`ALTER TABLE item_instances DROP CONSTRAINT item_instance_state;
    ALTER TABLE item_instances ADD CONSTRAINT item_instance_state ${oldState} NOT VALID`);
  await assert.rejects(migrateCityHomeStorage(client), error => error.code === 'city_home_storage_migration_invalid');
  assert.equal((await definition('item_instance_state')).convalidated, false);
  await client.query('ALTER TABLE item_instances VALIDATE CONSTRAINT item_instance_state');
  assert.equal((await migrateCityHomeStorage(client)).replaced, 2);
  // Exercise the real full schema boot seam, not just the targeted function. Schema
  // replay must not silently replace a present unknown/unvalidated custody predicate.
  await client.query('DROP TABLE item_instances');
  const schemaText = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  await migrateSchemaUnderLock(client, { schemaText });
  await client.query(`ALTER TABLE item_instances DROP CONSTRAINT item_instance_storage_legacy;
    ALTER TABLE item_instances DROP CONSTRAINT item_instance_state;
    ALTER TABLE item_instances ADD CONSTRAINT item_instance_state ${oldState};
    ALTER TABLE item_instances DROP CONSTRAINT item_instance_escrow_owner;
    ALTER TABLE item_instances ADD CONSTRAINT item_instance_escrow_owner ${oldOwner}`);
  await migrateSchemaUnderLock(client, { schemaText });
  assert.equal((await definition('item_instance_storage_legacy')).convalidated, true, 'Actual old-schema boot installs the absent custody gate.');
  await client.query("UPDATE schema_meta SET app_version='1.4.0',schema_sha='controlled-prior' WHERE id=1");
  const priorStamp = (await client.query('SELECT * FROM schema_meta WHERE id=1')).rows[0];
  await client.query(`ALTER TABLE item_instances DROP CONSTRAINT item_instance_storage_legacy;
    ALTER TABLE item_instances ADD CONSTRAINT item_instance_storage_legacy CHECK (true)`);
  const corrupt = await definition('item_instance_storage_legacy');
  await assert.rejects(migrateSchemaUnderLock(client, { schemaText }), error => error.code === 'city_home_storage_migration_invalid');
  assert.deepEqual(await definition('item_instance_storage_legacy'), corrupt, 'Full schema replay preserves and refuses the unknown gate.');
  assert.deepEqual((await client.query('SELECT * FROM schema_meta WHERE id=1')).rows[0], priorStamp, 'Refused custody boot never advances the stamp.');
  await client.query(`ALTER TABLE item_instances DROP CONSTRAINT item_instance_storage_legacy;
    ALTER TABLE item_instances ADD CONSTRAINT item_instance_storage_legacy CHECK (state<>'stored' OR definition_hash IS NULL) NOT VALID`);
  await assert.rejects(migrateSchemaUnderLock(client, { schemaText }), error => error.code === 'city_home_storage_migration_invalid');
  assert.equal((await definition('item_instance_storage_legacy')).convalidated, false, 'Boot never masks an unvalidated gate.');
  assert.deepEqual((await client.query('SELECT * FROM schema_meta WHERE id=1')).rows[0], priorStamp);
  await client.query('ALTER TABLE item_instances VALIDATE CONSTRAINT item_instance_storage_legacy');
  await migrateSchemaUnderLock(client, { schemaText });
  assert.equal((await client.query('SELECT app_version FROM schema_meta WHERE id=1')).rows[0].app_version, '1.5.0');
  console.log('Home custody native migration: existing rows, closed custody gates, restart, late DDL rollback/retry and drift/unvalidated refusal passed');
} finally {
  await client.query('SELECT pg_advisory_unlock(918273645)').catch(() => {});
  client.release(); await pool.end();
  await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end();
}
