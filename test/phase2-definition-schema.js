import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { database, schema, TABLES, compileFixture, materialSource } from './lib/phase2-definition-fixtures.js';
import * as db from '../src/db.js';
import { storeSealedBundle } from '../src/content/artifacts.js';

const { pool } = await database();
try {
  // Missing schema would leave atomic registration without its authoritative FK plane.
  for (const table of TABLES) {
    assert.equal((await pool.query(`SELECT * FROM ${table}`)).rows.length, 0);
  }
  await pool.query(schema);
  assert.equal(typeof db.verifyPhase2DefinitionSchema, 'function');
  await db.verifyPhase2DefinitionSchema(pool, { compatibility: 'pg-mem' });
  for (const [input, from, to, expected] of [
    ['abcabc', 'abc', '', ''], ['abc', 'abc', 'xy', 'xy'],
    ['aba', 'aab', 'xyz', 'xzx'], ['abc', '', '', 'abc'],
    [null, 'a', 'b', null], ['a', null, 'b', null], ['a', 'a', null, null],
  ]) assert.equal((await pool.query('SELECT translate($1,$2,$3) AS value', [input, from, to])).rows[0].value, expected);
  const material = compileFixture(materialSource());
  await storeSealedBundle(pool, material.request);
  // Each rejected UPDATE changes one field of a valid row, and owns a separate transaction.
  const rejected = async (table, field, value, name) => {
    await pool.query('BEGIN');
    try {
      await assert.rejects(pool.query(`UPDATE ${table} SET ${field}=$1`, [value]),
        (error) => error.message.includes(name), `${table}.${field} must reject ${String(value)}`);
    } finally { await pool.query('ROLLBACK'); }
  };
  for (const invalid of ['a'.repeat(63), 'A'.repeat(64), 'g'.repeat(64), ' '.repeat(64)]) {
    await rejected('content_bundle_artifacts', 'source_hash', invalid, 'p2_artifact_source_hash_ck');
  }
  await rejected('content_bundle_artifacts', 'compiler_version', 'a'.repeat(65), 'p2_artifact_compiler_version_ck');
  for (const [column, value, check] of [
    ['bundle_version', 0, 'bundle_version'], ['bundle_version', '9007199254740992', 'bundle_version'],
    ['artifact_format_version', 2, 'artifact_format_version'], ['ir_version', 2, 'ir_version'],
    ['definition_count', 20001, 'definition_count'], ['profile', 'phase3_mystery', 'profile'],
    ['canonical_bytes', Buffer.alloc(0), 'canonical_bytes'],
  ]) await rejected('content_bundle_artifacts', column, value, `p2_artifact_${check}_ck`);
  for (const [column, value, check] of [
    ['definition_kind', 'weapon', 'kind'], ['rarity', 'legendary', 'rarity'], ['quality_mode', 'random', 'quality'],
    ['conservation_class', 'infinite', 'conservation'], ['trade_mode', 'open', 'trade'],
    ['maximum_lot_quantity', 0, 'quantity'], ['maximum_lot_quantity', 1000001, 'quantity'],
    ['definition_version', 0, 'version'], ['family', null, 'required'], ['tags_json', null, 'required'],
    ['owner_scopes_json', '["account","account"]', 'scopes'],
    ['owner_scopes_json', '["project","account"]', 'scopes'],
    ['owner_scopes_json', '["operation"]', 'scopes'],
  ]) await rejected('item_definition_versions', column, value, `p2_definition_${check}_ck`);
  await rejected('content_bundle_item_definitions', 'ordinal', -1, 'p2_membership_ordinal_ck');
  await rejected('content_bundle_activations', 'activation_revision', 1, 'p2_pointer_state_ck');
  for (let mask = 0; mask < 16; mask++) {
    const scopes = ['account', 'character', 'organization', 'project'].filter((_, index) => mask & (1 << index));
    await pool.query('UPDATE item_definition_versions SET owner_scopes_json=$1', [JSON.stringify(scopes)]);
  }
  await rejected('content_bundle_item_definitions', 'definition_hash', '0'.repeat(64), 'p2_membership_definition_fk');
  const bundle = material.bundle;
  const event = (await pool.query(`INSERT INTO content_activation_events
    (namespace,activation_revision,bundle_hash,dependency_lock_hash,bundle_version,compiler_version,ir_version,
     profile,policy_snapshot_json,report_hashes_json,operator_id)
    VALUES ($1,1,$2,$3,1,$4,1,'phase2_economy',$5,$6,'schema-test') RETURNING id`,
  [bundle.package.id, bundle.hashes.bundleHash, bundle.hashes.dependencyLockHash, bundle.compilerVersion,
    '{"allowedProfiles":["phase2_economy"],"environment":"test"}', '{}'])).rows[0];
  await rejected('content_activation_events', 'activation_revision', 2, 'p2_event_previous_ck');
  await rejected('content_activation_events', 'dependency_lock_hash', '0'.repeat(64), 'p2_event_artifact_fk');
  await pool.query(`UPDATE content_bundle_activations SET activation_revision=1,bundle_hash=$1,
    last_event_id=$2,activated_by='schema-test',activated_at=now() WHERE namespace=$3`,
  [bundle.hashes.bundleHash, event.id, bundle.package.id]);
  const definitionHash = Object.values(bundle.hashes.definitionHashById)[0];
  await pool.query(`INSERT INTO item_definition_activations
    (logical_item_id,definition_hash,package_id,bundle_hash,activation_revision,event_id) VALUES ($1,$2,$3,$4,1,$5)`,
  [`${bundle.package.id}::mat.ferrous-scrap`, definitionHash, bundle.package.id, bundle.hashes.bundleHash, event.id]);
  await rejected('item_definition_activations', 'definition_hash', '0'.repeat(64), 'p2_selection_membership_fk');
  await rejected('item_definition_activations', 'package_id', 'omerta.foreign', 'p2_selection_event_fk');
  await rejected('content_bundle_activations', 'last_event_id', 999, 'p2_pointer_event_fk');
  console.log('phase2-definition-schema: clean schema, repeat application and translate pass');
} finally { await pool.end(); }

{
  const { pool: legacy } = await database({ schemaText: schema.slice(0, schema.indexOf('-- Phase 2 sealed definition plane;')) });
  try {
    await legacy.query(`INSERT INTO content_bundles
      (namespace,version,schema_version,content_hash,bundle_json,registered_by)
      VALUES ('omerta.workshop.bellini-lockbox',4,1,$1,'{}','pre-phase2-sentinel')`, ['b'.repeat(64)]);
    await legacy.query(`INSERT INTO content_activations (namespace,version,content_hash,activated_by)
      VALUES ('omerta.workshop.bellini-lockbox',4,$1,'pre-phase2-sentinel')`, ['b'.repeat(64)]);
    const beforeBundle = (await legacy.query('SELECT * FROM content_bundles')).rows;
    const beforeActivation = (await legacy.query('SELECT * FROM content_activations')).rows;
    await legacy.query(schema); await legacy.query(schema);
    assert.deepEqual((await legacy.query('SELECT * FROM content_bundles')).rows, beforeBundle);
    assert.deepEqual((await legacy.query('SELECT * FROM content_activations')).rows, beforeActivation);
    for (const table of TABLES) assert.equal((await legacy.query(`SELECT * FROM ${table}`)).rows.length, 0);
  } finally { await legacy.end(); }
}

// Optional focused local PostgreSQL schema evidence; the complete race/closure lane belongs to 3.3.
// No inferred DATABASE_URL: the caller must nominate this explicitly disposable endpoint.
if (process.env.PHASE2_REGISTRY_SCHEMA_TEST_URL) {
  const endpoint = process.env.PHASE2_REGISTRY_SCHEMA_TEST_URL;
  const admin = new pg.Pool({ connectionString: endpoint });
  const schemas = [];
  const oldUrl = process.env.DATABASE_URL;
  const oldCaps = { ...db.dbCaps };
  let real;
  const newSchema = async () => {
    const name = 'p2_registry_test_' + randomUUID().replaceAll('-', '');
    assert.match(name, /^p2_registry_test_[0-9a-f]{32}$/);
    schemas.push(name);
    await admin.query(`CREATE SCHEMA "${name}"`);
    return name;
  };
  try {
    const name = await newSchema();
    const url = new URL(endpoint);
    url.searchParams.set('options', `-c search_path=${name},public -c statement_timeout=20000 -c lock_timeout=3000`);
    process.env.DATABASE_URL = url.toString();
    real = await db.makeDb(); // Establish real capabilities through the supported boot path.
    await db.verifyPhase2DefinitionSchema(real, { compatibility: 'postgres' });
    await real.query(schema);
    await db.verifyPhase2DefinitionSchema(real, { compatibility: 'postgres' });
    const material = compileFixture(materialSource());
    assert.equal((await storeSealedBundle(real, material.request)).definitionCount, 1);
    const before = (await real.query('SELECT * FROM schema_meta')).rows;
    await real.query('ALTER TABLE item_definition_versions DROP CONSTRAINT p2_definition_quantity_ck');
    let afterDdl = false;
    const traced = { query: async (sql, values) => {
      if (sql === schema) afterDdl = true;
      if (afterDdl) assert(!/^ALTER TABLE.*ADD COLUMN|^UPDATE schema_meta|^INSERT INTO schema_meta/i.test(sql));
      return real.query(sql, values);
    } };
    await assert.rejects(db.migrateSchemaUnderLock(traced), (error) => error.code === 'content_registry_schema_invalid');
    assert.deepEqual((await real.query('SELECT * FROM schema_meta')).rows, before);
    await real.end(); real = null;
    const broken = await newSchema();
    const connection = await admin.connect();
    try {
      await connection.query(`SET search_path TO "${broken}",public`);
      await connection.query('CREATE TABLE content_bundle_artifacts (bundle_hash TEXT PRIMARY KEY)');
      const seen = [];
      await assert.rejects(db.migrateSchemaUnderLock({ query: async (sql, values) => {
        seen.push(sql); return connection.query(sql, values);
      } }), (error) => error.code !== 'content_registry_schema_invalid');
      assert.equal(seen.length, 1); // Native DDL failed before verifier, migrations or stamp.
    } finally { await connection.query('SET search_path TO public'); connection.release(); }
    console.log('phase2-definition-schema: PostgreSQL boot, exact catalog, reapplication, store and fail-closed drift pass');
  } finally {
    if (real) await real.end();
    if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
    Object.assign(db.dbCaps, oldCaps);
    for (const name of schemas) {
      assert.match(name, /^p2_registry_test_[0-9a-f]{32}$/);
      await admin.query(`DROP SCHEMA "${name}" CASCADE`);
    }
    await admin.end();
  }
}
