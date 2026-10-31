// Exact current-native boot-table delta. This does not admit historical source or native evidence.
import assert from 'node:assert/strict';
import { migrateDeedBenefitStorage } from '../src/deedbenefits.js';

export const DEED_BENEFIT_NATIVE_TABLE = 'street_deed_benefit_eligibility';
export const DEED_BENEFIT_NATIVE_DDL = `CREATE TABLE IF NOT EXISTS street_deed_benefit_eligibility (
    character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
    eligible_at TIMESTAMPTZ NOT NULL
  )`;
const fields = ['relations', 'columns', 'constraints', 'indexes'];
const table = DEED_BENEFIT_NATIVE_TABLE;
const belongs = (field, row) => (field === 'relations' ? row.name : row.table_name) === table;
const sorted = rows => rows.map(row => JSON.stringify(row)).sort();
const same = (actual, expected, label) => assert.deepEqual(sorted(actual), sorted(expected), label);
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

export async function assertDeedBenefitNativeMigration() {
  const queries = [];
  await migrateDeedBenefitStorage({ query: async (...args) => { queries.push(args); } });
  assert.deepEqual(queries, [[DEED_BENEFIT_NATIVE_DDL]], 'Current boot migration executes exactly the independently reviewed marker DDL');
}

export function deedBenefitNativeExpectedMetadata(serverVersionNum) {
  assert(Number.isInteger(serverVersionNum) && (serverVersionNum >= 160000 && serverVersionNum < 170000
    || serverVersionNum >= 180000 && serverVersionNum < 190000), 'Only qualified native PostgreSQL16/18 marker catalogs');
  const constraint = (suffix, type, definition, columns, extra = {}) => ({ table_name: table,
    name: table + '_' + suffix, type, validated: true, deferrable: false, deferred: false, definition,
    match_type: ' ', update_action: ' ', delete_action: ' ', referenced_schema: null,
    referenced_table: null, columns, referenced_columns: [], ...extra });
  const constraints = [constraint('character_id_fkey', 'f',
    'FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE', ['character_id'],
    { match_type: 's', update_action: 'a', delete_action: 'c', referenced_schema: '$self',
      referenced_table: 'characters', referenced_columns: ['id'] })];
  if (serverVersionNum >= 180000) for (const column of ['character_id', 'eligible_at']) {
    constraints.push(constraint(column + '_not_null', 'n', 'NOT NULL ' + column, [column]));
  }
  constraints.push(constraint('pkey', 'p', 'PRIMARY KEY (character_id)', ['character_id']));
  return freeze({ relations: [{ name: table, kind: 'r', persistence: 'p' }], columns: [
    { table_name: table, column_name: 'character_id', ordinal: 1, type: 'text', typmod: -1,
      default_expression: null, not_null: true, identity: '', generated: '', collation_schema: 'pg_catalog', collation_name: 'default' },
    { table_name: table, column_name: 'eligible_at', ordinal: 2, type: 'timestamp with time zone', typmod: -1,
      default_expression: null, not_null: true, identity: '', generated: '', collation_schema: null, collation_name: null },
  ], constraints, indexes: [{ table_name: table, name: table + '_pkey',
    definition: 'CREATE UNIQUE INDEX ' + table + '_pkey ON $self.' + table + ' USING btree (character_id)',
    unique: true, primary: true, valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null }] });
}

export function deedBenefitNativeRows(metadata, field) {
  assert(fields.includes(field)); assert(Array.isArray(metadata[field]));
  return metadata[field].filter(row => belongs(field, row));
}

export function deedBenefitNativeProjection(reference, serverVersionNum) {
  const expected = deedBenefitNativeExpectedMetadata(serverVersionNum);
  assert.deepEqual(Object.keys(reference).sort(), [...fields].sort(), 'Only the four complete marker catalog fields');
  for (const field of fields) same(reference[field], expected[field], 'Independently compiled exact marker ' + field);
  reference = freeze(structuredClone(reference));
  const projectMetadata = metadata => {
    assert.deepEqual(Object.keys(metadata).sort(), [...fields].sort(), 'Only the four complete current-native metadata fields');
    for (const field of fields) same(deedBenefitNativeRows(metadata, field), reference[field],
      'Every complete current marker ' + field + ' remains exact before historical projection');
    return Object.fromEntries(fields.map(field => [field, metadata[field].filter(row => !belongs(field, row))]));
  };
  const projectConstraints = (rows, includeNotNull = true) => {
    assert.equal(typeof includeNotNull, 'boolean');
    const constraints = reference.constraints.filter(row => includeNotNull || row.type !== 'n')
      .map(({ table_name, name, definition }) => ({ table_name, name, definition }));
    same(rows.filter(row => row.table_name === table), constraints,
      'Every exact current marker constraint remains required before the unchanged old oracle');
    return rows.filter(row => row.table_name !== table);
  };
  const extendReference = base => freeze(Object.fromEntries(fields.map(field => {
    assert.equal(deedBenefitNativeRows(base, field).length, 0, 'The historical reference cannot already contain the marker');
    return [field, [...base[field], ...reference[field]]];
  })));
  return Object.freeze({ reference, projectMetadata, projectConstraints, extendReference });
}

export async function assertDeedBenefitNativeSecurity(pool) {
  const rows = (await pool.query(`SELECT c.relname AS name,c.relrowsecurity AS enabled,c.relforcerowsecurity AS forced,
    EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='omerta_direct_access_denied'
      AND NOT p.polpermissive AND p.polcmd='*' AND p.polroles=ARRAY[0::oid]
      AND pg_get_expr(p.polqual,p.polrelid)='false' AND pg_get_expr(p.polwithcheck,p.polrelid)='false') AS denied,
    NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee=0) AS public_revoked
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=current_schema() AND c.relkind='r' AND c.relname=$1 ORDER BY c.relname`, [table])).rows;
  assert.deepEqual(rows, [{ name: table, enabled: true, forced: false, denied: true, public_revoked: true }],
    'The current marker retains restrictive direct-role RLS and revoked PUBLIC access');
}
