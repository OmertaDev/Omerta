// Native test-only expectations compiled from immutable reviewed source, never the upgraded DB.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const CITY_GAMEPLAY_MIGRATION_SOURCE = Object.freeze({
  revision: 'c75eb6de12ad9816d4a48f1e614a099098144eec',
  blob: '1ffd783d07afb54069b7b06388c72e1980d3fea2',
  sha256: '7e54cfb47198e244275d4c269b6fa1709f04b186fa7cbc7cbc211cf26f3f9aab',
});
const PREVIOUS_SOURCE = Object.freeze({
  revision: '8dbe85846035dc0fcdba76992834e411632c6f1b',
  blob: 'ba2c528efe09153899c7fc1ef3c543d95b1f7285',
  sha256: '2313bee0087bc90c5987ab6482d1cdc176a3060da8e24f487453a518d79a27c0',
});
const manifest = {
  city_home_rooms: {
    constraints: ['pkey', 'home_key_check', 'authority_token_check', 'revision_check', 'owner_account_id_fkey'],
    columns: ['home_key', 'authority_token', 'owner_account_id', 'layout_json', 'revision', 'created_at', 'layout_revision'],
  },
  city_home_visitors: {
    constraints: ['pkey', 'id_check', 'host_generation_check', 'guest_generation_check', 'status_check',
      'host_character_id_fkey', 'guest_account_id_fkey', 'guest_character_id_fkey', 'home_key_authority_token_fkey'],
    columns: ['id', 'home_key', 'authority_token', 'host_character_id', 'host_generation', 'guest_account_id',
      'guest_character_id', 'guest_generation', 'rights_json', 'status', 'expires_at', 'created_at', 'accepted_at', 'revoked_at'],
  },
  city_home_storage_items: {
    constraints: ['pkey', 'owner_scope_check', 'item_state_check', 'owner_id_fkey',
      'home_key_authority_token_fkey', 'item_id_owner_scope_owner_id_item__fkey'],
    columns: ['item_id', 'owner_scope', 'owner_id', 'item_state', 'home_key', 'authority_token', 'created_at'],
  },
  city_npc_favors: {
    constraints: ['pkey', 'owner_generation_check', 'npc_generation_check', 'favor_check', 'check',
      'owner_character_id_fkey', 'npc_character_id_fkey'],
    columns: ['owner_character_id', 'owner_generation', 'npc_character_id', 'npc_generation', 'favor', 'updated_at'],
  },
  city_encounters: {
    constraints: ['pkey', 'owner_generation_check', 'scenario_id_check', 'district_check', 'revision_check',
      'status_check', 'model_json_check', 'check', 'owner_character_id_fkey'],
    columns: ['id', 'owner_character_id', 'owner_generation', 'scenario_id', 'district', 'revision', 'status',
      'model_json', 'created_at', 'completed_at'],
  },
  city_home_activities: {
    constraints: ['pkey', 'host_generation_check', 'puzzle_id_check', 'layout_revision_check', 'layout_json_check',
      'status_check', 'check', 'host_account_id_fkey', 'host_character_id_fkey', 'home_key_authority_token_fkey'],
    columns: ['id', 'home_key', 'authority_token', 'host_account_id', 'host_character_id', 'host_generation',
      'puzzle_id', 'layout_revision', 'layout_json', 'status', 'close_reason', 'created_at', 'closed_at'],
  },
  city_home_activity_members: {
    constraints: ['pkey', 'generation_check', 'name_snapshot_check', 'step_check', 'status_check', 'check', 'check1',
      'activity_id_fkey', 'account_id_fkey', 'character_id_fkey'],
    columns: ['activity_id', 'account_id', 'character_id', 'generation', 'name_snapshot', 'step', 'status',
      'consent_at', 'left_at', 'solved_at', 'outcome_json'],
  },
};
for (const [table, value] of Object.entries(manifest)) {
  for (const suffix of value.constraints) {
    const name = `${table}_${suffix}`;
    assert(Buffer.byteLength(name, 'utf8') <= 63, `Declared gameplay constraint name exceeds PostgreSQL's 63-byte identifier limit: ${name}`);
  }
  Object.freeze(value.constraints); Object.freeze(value.columns); Object.freeze(value);
}
export const CITY_GAMEPLAY_MIGRATION_TABLES = Object.freeze(Object.keys(manifest));
export const CITY_GAMEPLAY_MIGRATION_ADDED_KEYS = Object.freeze([
  'item_instances.item_instance_storage_legacy',
  'mystery_instances.mystery_instance_npc_binding',
  'mystery_instances.mystery_instances_npc_character_id_fkey',
]);
export const CITY_GAMEPLAY_MIGRATION_REPLACED_KEYS = Object.freeze([
  'item_instances.item_instance_state', 'item_instances.item_instance_escrow_owner',
  'item_mutation_guards.item_guard_kind', 'item_events.item_event_kind',
]);
const addedColumns = Object.freeze(['street_deeds.home_authority_token', 'mystery_instances.owner_generation',
  'mystery_instances.npc_character_id', 'mystery_instances.npc_generation']);
const tables = new Set(CITY_GAMEPLAY_MIGRATION_TABLES);
const added = new Set(CITY_GAMEPLAY_MIGRATION_ADDED_KEYS), replaced = new Set(CITY_GAMEPLAY_MIGRATION_REPLACED_KEYS);
const constraintKey = row => `${row.table_name}.${row.name}`;
const columnKey = row => `${row.table_name}.${row.column_name}`;
const sortBy = (rows, key) => [...rows].sort((a, b) => key(a).localeCompare(key(b)));
const constraintScope = row => tables.has(row.table_name) || added.has(constraintKey(row)) || replaced.has(constraintKey(row));
const columnScope = row => tables.has(row.table_name) || addedColumns.includes(columnKey(row));
const expectedKeys = [...Object.entries(manifest).flatMap(([table, entry]) => entry.constraints.map(name => `${table}.${table}_${name}`)),
  ...CITY_GAMEPLAY_MIGRATION_ADDED_KEYS, ...CITY_GAMEPLAY_MIGRATION_REPLACED_KEYS].sort();
const expectedColumns = [...Object.entries(manifest).flatMap(([table, entry]) => entry.columns.map(name => `${table}.${name}`)), ...addedColumns].sort();
const schemaTables = [...tables, 'item_instances', 'item_mutation_guards', 'item_events', 'mystery_instances', 'street_deeds'];
const repo = fileURLToPath(new URL('../../', import.meta.url));

function reportDeclaredNameMismatch(actual, expected, kind) {
  if (actual.length === expected.length && actual.every((name, index) => name === expected[index])) return;
  const actualNames = new Set(actual), expectedNames = new Set(expected);
  const missing = expected.filter(name => !actualNames.has(name)), unexpected = actual.filter(name => !expectedNames.has(name));
  const boundedNames = names => names.filter(name => typeof name === 'string' && Buffer.byteLength(name, 'utf8') <= 160
    && /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(name)).slice(0, 8);
  console.error('City gameplay migration catalog name mismatch: ' + JSON.stringify({ kind,
    actualCount: actual.length, expectedCount: expected.length, missingCount: missing.length, unexpectedCount: unexpected.length,
    missing: boundedNames(missing), unexpected: boundedNames(unexpected) }));
}

function reviewedSchema(pin) {
  const target = `${pin.revision}:schema.sql`;
  assert.equal(execFileSync('git', ['rev-parse', target], { cwd: repo, encoding: 'utf8' }).trim(), pin.blob);
  const source = execFileSync('git', ['show', target], { cwd: repo, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'), pin.sha256, 'Immutable reviewed schema bytes changed');
  return source;
}

export function cityGameplayMigrationPredecessorSchema() {
  return reviewedSchema(PREVIOUS_SOURCE);
}

// These four closed clauses are extracted only after verifying the entire incoming source.
// The final declaration is authoritative for its idempotently rebuilt guard/event vocabulary.
function previousPredicate(source, name, count) {
  const declarations = [...source.matchAll(new RegExp(`CONSTRAINT ${name} CHECK\\s*\\(`, 'g'))];
  assert.equal(declarations.length, count, `${name} has only its reviewed declarations`);
  const start = declarations.at(-1).index + declarations.at(-1)[0].length - 1;
  let depth = 0, quoted = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (char === "'") { if (quoted && source[i + 1] === "'") i++; else quoted = !quoted; }
    else if (!quoted && char === '(') depth++;
    else if (!quoted && char === ')' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail(`Unclosed reviewed ${name} clause`);
}

export async function readCityGameplayMigrationMetadata(pool) {
  const constraints = (await pool.query(`SELECT t.relname::text AS table_name,c.conname::text AS name,
    c.contype::text AS type,c.convalidated AS validated FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=current_schema() AND c.contype<>'n'
    AND t.relname::text=ANY($1::text[]) ORDER BY t.relname,c.conname`, [schemaTables])).rows.filter(constraintScope);
  const columns = (await pool.query(`SELECT t.relname::text AS table_name,a.attname::text AS column_name,
    format_type(a.atttypid,a.atttypmod) AS type,pg_get_expr(d.adbin,d.adrelid) AS default_expression,a.attnotnull AS not_null
    FROM pg_attribute a JOIN pg_class t ON t.oid=a.attrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=t.oid AND d.adnum=a.attnum
    WHERE n.nspname=current_schema() AND t.relname::text=ANY($1::text[]) AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY t.relname,a.attname`, [schemaTables])).rows.filter(columnScope);
  return { constraints, columns };
}

export function cityGameplayMigrationEndpoint(address) {
  assert.equal(typeof address, 'string', 'An explicit disposable native fixture is required');
  let endpoint;
  try { endpoint = new URL(address); } catch { assert.fail('The disposable native fixture URL is invalid'); }
  assert(!endpoint.search && !endpoint.hash, 'Fixture URL cannot override native connection options');
  assert(['postgres:', 'postgresql:'].includes(endpoint.protocol)
    && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only an explicit loopback PostgreSQL fixture is allowed');
  assert(['/omerta_query', '/omerta_check'].includes(endpoint.pathname), 'Only the reviewed named CI fixture databases are allowed');
  return endpoint;
}

export async function createCityGameplayMigrationCatalog(admin, address) {
  const endpoint = cityGameplayMigrationEndpoint(address);
  const currentSource = reviewedSchema(CITY_GAMEPLAY_MIGRATION_SOURCE), previousSource = reviewedSchema(PREVIOUS_SOURCE);
  const namespace = 'city_gameplay_reference_' + crypto.randomBytes(8).toString('hex');
  assert(/^city_gameplay_reference_[a-f0-9]{16}$/.test(namespace));
  let client, created = false;
  try {
    await admin.query(`CREATE SCHEMA ${namespace}`); created = true;
    endpoint.searchParams.set('options', `-c search_path=${namespace} -c lock_timeout=8000 -c statement_timeout=30000`);
    client = new pg.Client({ connectionString: endpoint.toString() }); await client.connect();
    const provenance = (await client.query('SELECT current_schema() AS schema,version() AS version')).rows[0];
    assert.equal(provenance.schema, namespace); assert.match(provenance.version, /^PostgreSQL /);
    await client.query(currentSource);
    const rows = (await client.query(`SELECT t.relname::text AS table_name,c.conname::text AS name,
      pg_get_constraintdef(c.oid,true) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=current_schema() AND c.contype<>'n'
      ORDER BY t.relname,c.conname`)).rows.filter(constraintScope);
    reportDeclaredNameMismatch(rows.map(constraintKey).sort(), expectedKeys, 'constraints');
    assert.deepEqual(rows.map(constraintKey).sort(), expectedKeys, 'Pinned gameplay source has exactly its declared constraint keys');
    const metadata = await readCityGameplayMigrationMetadata(client);
    reportDeclaredNameMismatch(metadata.columns.map(columnKey).sort(), expectedColumns, 'columns');
    assert.deepEqual(metadata.columns.map(columnKey).sort(), expectedColumns, 'Pinned gameplay source has exactly its declared columns');
    assert(metadata.constraints.every(row => row.validated === true), 'Pinned reference constraints are validated');
    const clauses = [['item_instance_state', 1], ['item_instance_escrow_owner', 1], ['item_guard_kind', 2], ['item_event_kind', 2]];
    await client.query('BEGIN');
    await client.query(`CREATE TEMP TABLE city_gameplay_previous_reference
      (state TEXT,owner_scope TEXT,mutation_kind TEXT,event_kind TEXT,event_branch TEXT,
      ${clauses.map(([name, count]) => `CONSTRAINT original_${name} CHECK ${previousPredicate(previousSource, name, count)}`).join(',\n')}) ON COMMIT DROP`);
    const old = (await client.query(`SELECT conname,pg_get_constraintdef(oid,true) AS definition FROM pg_constraint
      WHERE conrelid='pg_temp.city_gameplay_previous_reference'::regclass`)).rows;
    // This separate current-source envelope does not broaden the immutable gameplay pin.
    // Exactly one named predicate admits the new cooperative puzzle, with no column delta.
    await client.query(`CREATE TEMP TABLE city_home_cooperative_reference (puzzle_id TEXT,
      CONSTRAINT puzzle_original CHECK (puzzle_id IN ('evening-notebook','lights-out','visitor-welcome')),
      CONSTRAINT puzzle_current CHECK (puzzle_id IN ('evening-notebook','lights-out','visitor-welcome','two-voices-v1'))
    ) ON COMMIT DROP`);
    const puzzleRows = (await client.query(`SELECT conname,pg_get_constraintdef(oid,true) AS definition FROM pg_constraint
      WHERE conrelid='pg_temp.city_home_cooperative_reference'::regclass`)).rows;
    const puzzleDefinitions = new Map(puzzleRows.map(row => [row.conname,row.definition]));
    assert.equal(puzzleDefinitions.size, 2);
    const puzzleKey = 'city_home_activities.city_home_activities_puzzle_id_check';
    const originalPuzzle = rows.filter(row => constraintKey(row) === puzzleKey);
    assert.equal(originalPuzzle.length, 1);
    assert.equal(originalPuzzle[0].definition, puzzleDefinitions.get('puzzle_original'), 'The original pinned puzzle admission is exact');
    const qualifiedRows = rows.map(row => constraintKey(row) === puzzleKey ? { ...row, definition: puzzleDefinitions.get('puzzle_current') } : row);
    await client.query('COMMIT');
    const oldDefinitions = new Map(old.map(row => [row.conname.slice('original_'.length), row.definition]));
    assert.equal(oldDefinitions.size, 4);
    for (const row of [...rows, ...metadata.constraints, ...metadata.columns]) Object.freeze(row);
    Object.freeze(rows); Object.freeze(metadata.constraints); Object.freeze(metadata.columns);
    const verifyMetadata = actual => {
      assert.deepEqual(sortBy(actual.constraints.filter(constraintScope), constraintKey), metadata.constraints,
        'Gameplay constraints retain exact validated types');
      assert.deepEqual(sortBy(actual.columns.filter(columnScope), columnKey), metadata.columns,
        'Gameplay columns retain exact reviewed types, typmods, defaults and nullability');
    };
    const normalize = (actual, original) => {
      assert.deepEqual(sortBy(actual.filter(constraintScope), constraintKey), qualifiedRows,
        'Gameplay migration preserves the immutable catalogue with only the separately declared cooperative puzzle replacement');
      for (const key of replaced) {
        const prior = original.filter(row => constraintKey(row) === key);
        assert.equal(prior.length, 1, `Original ${key} exists exactly once`);
        assert.equal(prior[0].definition, oldDefinitions.get(prior[0].name), `Original ${key} has its exact reviewed incoming predicate`);
      }
      // Preserve the caller's SQL catalog order for its original complete oracle.
      return actual.filter(row => !tables.has(row.table_name) && !added.has(constraintKey(row)))
        .map(row => replaced.has(constraintKey(row)) ? { ...row, definition: oldDefinitions.get(row.name) } : row);
    };
    return Object.freeze({ normalize, verifyMetadata, keys: Object.freeze([...expectedKeys]), referenceColumns: metadata.columns,
      tableCount: tables.size, constraintCount: rows.length, source: CITY_GAMEPLAY_MIGRATION_SOURCE });
  } finally {
    if (client) { await client.query('ROLLBACK').catch(() => {}); await client.end(); }
    if (created) {
      const owner = (await admin.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1', [namespace])).rows[0];
      assert.equal(owner?.mine, true, 'Drop only the generated reference schema owned by this connection');
      await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
    }
  }
}
