// Exact current UX extension. Original Commerce/Deed native sources and assertions remain intact.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
import pg from 'pg';
import * as original from './commerce-deed-release-phase2-native-catalog.js';
import { economyHardeningSourceBaseline } from './economy-hardening-source-transfer.js';
import { economyUxMergeCandidateHistoricalInput,
  economyUxMergeMainHistoricalInput } from './economy-ux-merge-source-compatibility.js';
import { UX_SOURCE, qualifyUxSource } from './ux-source-compatibility.js';
import { DEED_BENEFIT_NATIVE_DDL, DEED_BENEFIT_NATIVE_TABLE, assertDeedBenefitNativeMigration,
  assertDeedBenefitNativeSecurity, deedBenefitNativeRows, deedBenefitNativeProjection } from './deed-benefit-native-catalog.js';
export * from './commerce-deed-release-phase2-native-catalog.js';

export const UX_NATIVE_TABLES = Object.freeze(['ux_community_documents', 'ux_community_entries', 'ux_community_portrait_consents', 'ux_crew_notes', 'ux_crew_signals', 'ux_mentor_subjects', 'ux_workspaces']);
const names = new Set(UX_NATIVE_TABLES), fields = ['relations', 'columns', 'constraints', 'indexes'];
const storeRevenueTable = 'store_payments', storeRevenueColumn = 'revenue_split';
const isStoreRevenueColumn = row => row.table_name === storeRevenueTable && row.column_name === storeRevenueColumn;
const storeTrailingColumns = ['account_id', 'granted', 'created_at'];
const socialBridgeTable = 'social_claims', socialBridgeColumn = 'legacy_proof_bridge',
  socialProofContractColumn = 'proof_contract',
  socialBridgeConstraint = 'social_claims_legacy_proof_bridge_not_null',
  socialExtensionColumns = new Set([socialBridgeColumn, socialProofContractColumn]);
const socialBridgeDdl = `CREATE TABLE social_claims (
  account_id TEXT NOT NULL,
  day INT NOT NULL,
  task_id TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid BOOLEAN NOT NULL DEFAULT false,
  proof TEXT,
  legacy_proof_bridge BOOLEAN NOT NULL DEFAULT true,
  proof_contract TEXT,
  PRIMARY KEY (account_id, day, task_id)
);`;
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
const currentSchema = git('show', UX_SOURCE.revision + ':schema.sql');
const predecessorSchema = qualifyUxSource('schema.sql', currentSchema).baselineText;
assert(currentSchema.startsWith(predecessorSchema), 'The reviewed UX schema is a literal append only');
const uxDdl = currentSchema.slice(predecessorSchema.length);
assert.deepEqual([...uxDdl.matchAll(/^CREATE TABLE IF NOT EXISTS (\w+) /gm)].map(match => match[1]).sort(), UX_NATIVE_TABLES);
assert(!/\b(?:ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(uxDdl), 'Only the seven inert table/index definitions');
const tableOf = (field, row) => field === 'relations' ? row.name : row.table_name;
const uxRows = (metadata, field) => metadata[field].filter(row => names.has(tableOf(field, row)));
const isSocialBridgeRow = (field, row) => field === 'columns'
  ? row.table_name === socialBridgeTable && socialExtensionColumns.has(row.column_name)
  : field === 'constraints' && row.table_name === socialBridgeTable && row.name === socialBridgeConstraint;
const socialBridgeRows = (metadata, field) => metadata[field].filter(row => isSocialBridgeRow(field, row));
const monitorIndexName = 'ix_tx_at_id';
const isMonitorIndexRow = (field, row) => field === 'indexes' && row.table_name === 'transactions' && row.name === monitorIndexName;
const monitorRows = (metadata, field) => metadata[field].filter(row => isMonitorIndexRow(field, row));
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
// Keep the original engine's exact predecessor order; insert the existing-table bridge at its exact
// catalog anchors, then retain the reviewed UX append order. No collation normalization is introduced.
const merge = (base, socialBridge, ux, monitor) => {
  const merged = Object.fromEntries(fields.map(field => [field, [...base[field]]]));
  assert.equal(socialBridge.columns.length, 2); assert(socialBridge.constraints.length <= 1);
  assert.deepEqual(socialBridge.columns.map(row => row.column_name),
    [socialBridgeColumn, socialProofContractColumn], 'Exact bridge/contract catalog order');
  const columnAt = merged.columns.findIndex(row => row.table_name === socialBridgeTable && row.column_name === 'proof');
  assert(columnAt >= 0 && merged.columns[columnAt].ordinal === 6,
    'Social bridge and proof contract follow the exact predecessor proof column');
  merged.columns.splice(columnAt + 1, 0, ...socialBridge.columns);
  if (socialBridge.constraints.length) {
    const constraintAt = merged.constraints.findIndex(row => row.table_name === socialBridgeTable && row.name === 'social_claims_paid_not_null');
    assert(constraintAt >= 0, 'PostgreSQL 18 social bridge constraint precedes the exact paid anchor');
    merged.constraints.splice(constraintAt, 0, ...socialBridge.constraints);
  }
  for (const field of fields) merged[field].push(...ux[field]);
  const indexAt = merged.indexes.findIndex(row => row.table_name === 'transactions' && row.name === 'ix_tx_character');
  assert(indexAt >= 0, 'The monitor index precedes the exact predecessor transaction index');
  merged.indexes.splice(indexAt, 0, ...monitor.indexes);
  return freeze(merged);
};

// The unchanged historical constructor also reads its caller's catalog internally. Only its four
// exact, immutable catalog SELECTs get the validated UX projection; all other queries stay real.
const commerceDeedHelper = 'tools/commerce-deed-release-phase2-native-catalog.js';
const commerceDeedRaw = fs.readFileSync(new URL('./commerce-deed-release-phase2-native-catalog.js', import.meta.url), 'utf8');
const commerceDeedCandidate = economyUxMergeCandidateHistoricalInput(commerceDeedHelper, commerceDeedRaw);
const commerceDeedMain = economyUxMergeMainHistoricalInput(commerceDeedHelper, commerceDeedRaw);
assert.equal(economyHardeningSourceBaseline(commerceDeedHelper, commerceDeedCandidate), commerceDeedMain,
  'Integrated economy and UX helper parents must share the exact predecessor');
assert.equal(commerceDeedMain,
  git('show', UX_SOURCE.revision + ':tools/commerce-deed-release-phase2-native-catalog.js'), 'Whole original native helper remains unchanged');
const catalogQueries = [];
function collectCatalogQueries(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'CallExpression' && node.callee?.object?.name === 'pool' && node.callee?.property?.name === 'query') {
    const argument = node.arguments[0];
    assert(argument.type === 'Literal' && typeof argument.value === 'string' || argument.type === 'TemplateLiteral' && argument.expressions.length === 0, 'Only closed original metadata SQL');
    catalogQueries.push(argument.type === 'Literal' ? argument.value : argument.quasis[0].value.cooked);
  }
  for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(collectCatalogQueries); else if (value && typeof value === 'object') collectCatalogQueries(value);
}
collectCatalogQueries(parse(original.readCommerceReleasePhase2Metadata.toString(), { ecmaVersion: 'latest' }));
assert.equal(catalogQueries.length, 5); assert.equal(new Set(catalogQueries).size, 5);
const catalogFields = new Map(catalogQueries.slice(1).map((sql, index) => [sql, ['relations', 'constraints', 'columns', 'indexes'][index]]));
async function assertNativeCaller(pool, endpoint, profile, includeNotNull) {
  const address = new URL(endpoint), local = ['35439', '35449'].includes(address.port) && address.username === 'pilot_runner' && !address.password,
    ci = address.port === '5432' && address.username === 'postgres' && address.password === 'pgcheck';
  assert(['postgres:', 'postgresql:'].includes(address.protocol) && address.hostname === '127.0.0.1' && !address.search && !address.hash && (local || ci));
  assert(['/omerta_check', '/omerta_query'].includes(address.pathname));
  const main = String(process.argv[1]).replaceAll('\\', '/');
  const settings = (await pool.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];
  if (main.endsWith('/test/director-migration.js')) {
    assert.equal(process.argv.length, 3); assert.equal(process.argv[2], '--postgres'); assert.equal(profile, 'director'); assert.equal(includeNotNull, false);
    const configured = process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL;
    assert(configured, 'The original explicit Director fixture endpoint is required');
    assert.equal(new URL(configured).href, address.href, 'Director uses its original selected fixture endpoint');
    assert.match(settings.schema, /^director_migration_[a-f0-9]{16}$/);
  } else {
    assert(main.endsWith('/test/phase2-postgres.js')); assert(['phase2', 'fresh'].includes(profile)); assert.equal(includeNotNull, true);
    assert.equal(process.argv[2], profile === 'phase2' ? '--definitions' : '--lots');
    assert.equal(process.env.P2_TEST_CHILD, profile === 'phase2' ? 'upgrade' : 'lots-catalog');
    assert.match(settings.schema, /^p2_definitions_[a-f0-9]{32}$/); assert.equal(settings.schema, process.env.P2_TEST_SCHEMA);
  }
  assert.equal(settings.role, address.username); assert.equal('/' + settings.database, address.pathname);
}
async function projectedCaller(pool, ux, socialBridge, monitor, benefitNative, storeRevenue) {
  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),
    monitorProjection = monitorNativeProjection(monitor);
  const projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(
    uxProjection.projectMetadata(benefitNative.projectMetadata(storeRevenue.projectMetadata(metadata)))));
  const context = (await pool.query(catalogQueries[0])).rows[0];
  const verify = async () => { projectMetadata(await original.readCommerceReleasePhase2Metadata(pool)); await assertUxNativeSecurity(pool); await assertDeedBenefitNativeSecurity(pool); };
  await verify();
  const wrap = (queryable, guarded) => ({ query: async (sql, values) => {
    if (guarded && sql === catalogQueries[0]) await verify();
    const result = await queryable.query(sql, values), field = catalogFields.get(sql);
    if (!field) return result;
    let selected = result.rows.filter(row => names.has(tableOf(field, row)));
    if (field === 'indexes') selected = selected.map(row => {
      const prefix = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(prefix).length, 2);
      return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };
    });
    assert.deepEqual(selected, ux[field], 'Every fresh projected SQL result retains the complete UX ' + field);
    assert.deepEqual(socialBridgeRows({ [field]: result.rows }, field), socialBridge[field],
      'Every fresh projected SQL result retains the exact social bridge ' + field);
    const monitorSelected = monitorRows({ [field]: result.rows }, field).map(row => {
      const prefix = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(prefix).length, 2);
      return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };
    });
    assert.deepEqual(monitorSelected, monitor[field], 'Every fresh projected SQL result retains the exact monitor ' + field);
    let benefitRows = deedBenefitNativeRows({ [field]: result.rows }, field);
    if (field === 'indexes') benefitRows = benefitRows.map(row => {
      const prefix = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(prefix).length, 2);
      return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };
    });
    assert.deepEqual(benefitRows, benefitNative.reference[field], 'Every fresh projected SQL result retains the complete current marker ' + field);
    if (guarded) { await assertUxNativeSecurity(pool); await assertDeedBenefitNativeSecurity(pool); }
    const rows = result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row)
      && !isMonitorIndexRow(field, row) && tableOf(field, row) !== DEED_BENEFIT_NATIVE_TABLE);
    return { ...result, rows: field === 'columns' ? storeRevenue.projectColumns(rows) : rows };
  } });
  return { ...wrap(pool, true), connect: async () => {
    const client = await pool.connect();
    return { ...wrap(client, false), release: client.release.bind(client) };
  } };
}

export async function assertUxNativeSecurity(pool) {
  const rows = (await pool.query(`SELECT c.relname AS name,c.relrowsecurity AS enabled,c.relforcerowsecurity AS forced,
    EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='omerta_direct_access_denied'
      AND NOT p.polpermissive AND p.polcmd='*' AND p.polroles=ARRAY[0::oid]
      AND pg_get_expr(p.polqual,p.polrelid)='false' AND pg_get_expr(p.polwithcheck,p.polrelid)='false') AS denied,
    NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee=0) AS public_revoked
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=current_schema() AND c.relkind='r' AND c.relname IN ($1,$2,$3,$4,$5,$6,$7) ORDER BY c.relname`, UX_NATIVE_TABLES)).rows;
  assert.deepEqual(rows, UX_NATIVE_TABLES.map(name => ({ name, enabled: true, forced: false, denied: true, public_revoked: true })), 'Every exact UX table retains restrictive direct-role RLS and revoked PUBLIC access');
}
async function readArchivedComparisonMetadata(pool) {
  const metadata = await original.readCommerceReleasePhase2Metadata(pool);
  await assertUxNativeSecurity(pool); await assertDeedBenefitNativeSecurity(pool); return metadata;
}
async function compileCurrentExtensionReference(pool, endpoint, profile) {
  assert(['fresh', 'phase2', 'director'].includes(profile));
  const schema = 'release_phase2_ref_' + crypto.randomBytes(8).toString('hex');
  assert.match(schema, /^release_phase2_ref_[a-f0-9]{16}$/);
  let created = false, client;
  try {
    assert.equal((await pool.query('SELECT nspname FROM pg_namespace WHERE nspname=$1', [schema])).rows.length, 0);
    await pool.query('CREATE SCHEMA ' + schema); created = true;
    const address = new URL(endpoint); address.searchParams.set('options', `-c search_path=${schema} -c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000`);
    client = new pg.Client({ connectionString: address.toString() }); await client.connect();
    const settings = (await client.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];
    const parent = (await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];
    assert.equal(settings.schema, schema); assert.equal(settings.database, parent.database); assert.equal(settings.role, parent.role);
    // Compile the monitor index independently of schema.sql and the migrated caller. Only this
    // exact additive index is projected from the unchanged predecessor's complete catalog proof.
    await assertDeedBenefitNativeMigration();
    const storeDdl = `CREATE TABLE store_payments (
      nonce BIGINT PRIMARY KEY, sku TEXT NOT NULL, payer_address TEXT NOT NULL,
      amount_wei TEXT NOT NULL, tx_hash TEXT, ${profile === 'fresh' ? 'revenue_split JSONB,' : ''}
      account_id TEXT, granted BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );` + (profile === 'fresh' ? '' : '\nALTER TABLE store_payments ADD COLUMN revenue_split JSONB;');
    await client.query('CREATE TABLE characters (id TEXT PRIMARY KEY);\n' + DEED_BENEFIT_NATIVE_DDL + ';\n' + socialBridgeDdl + '\n' + storeDdl + '\n' + uxDdl
      + '\nCREATE TABLE transactions (at TIMESTAMPTZ, id TEXT);\nCREATE INDEX ix_tx_at_id ON transactions (at, id);');
    const reference = await original.readCommerceReleasePhase2Metadata(client);
    assert.deepEqual(reference.relations.map(row => row.name), ['characters', socialBridgeTable, storeRevenueTable, DEED_BENEFIT_NATIVE_TABLE, 'transactions', ...UX_NATIVE_TABLES],
      'Independent immutable DDL creates exactly the FK target, current marker, social bridge, Store and monitor fixtures and seven UX tables');
    const ux = Object.fromEntries(fields.map(field => [field, uxRows(reference, field)]));
    assert.deepEqual(ux.relations.map(row => row.name), UX_NATIVE_TABLES, 'Independent immutable DDL creates exactly the seven UX tables');
    const socialBridge = Object.fromEntries(fields.map(field => [field, socialBridgeRows(reference, field)]));
    assert.deepEqual(socialBridge.columns, [
      { table_name: socialBridgeTable, column_name: socialBridgeColumn,
        ordinal: 7, type: 'boolean', typmod: -1, default_expression: 'true', not_null: true,
        identity: '', generated: '', collation_schema: null, collation_name: null },
      { table_name: socialBridgeTable, column_name: socialProofContractColumn,
        ordinal: 8, type: 'text', typmod: -1, default_expression: null, not_null: false,
        identity: '', generated: '', collation_schema: 'pg_catalog', collation_name: 'default' },
    ], 'Independent immutable DDL creates the exact ordinal-7 bridge and nullable ordinal-8 proof contract');
    const version = Number((await client.query("SELECT current_setting('server_version_num') AS version")).rows[0].version);
    assert.equal(socialBridge.constraints.length, version >= 180000 ? 1 : 0,
      'Only PostgreSQL 18 exposes the exact social bridge NOT NULL constraint row');
    if (version >= 180000) assert.deepEqual(socialBridge.constraints, [{ table_name: socialBridgeTable,
      name: socialBridgeConstraint, type: 'n', validated: true, deferrable: false, deferred: false,
      definition: 'NOT NULL legacy_proof_bridge', match_type: ' ', update_action: ' ', delete_action: ' ',
      referenced_schema: null, referenced_table: null, columns: [socialBridgeColumn], referenced_columns: [] }],
    'PostgreSQL 18 exposes the exact generated social bridge NOT NULL catalog row');
    assert.equal(socialBridge.relations.length + socialBridge.indexes.length, 0, 'The social bridge adds no relation or index');
    const monitor = Object.fromEntries(fields.map(field => [field, monitorRows(reference, field)]));
    assert.deepEqual(monitor.indexes, [{ table_name: 'transactions', name: monitorIndexName,
      definition: 'CREATE INDEX ix_tx_at_id ON $self.transactions USING btree (at, id)',
      unique: false, primary: false, valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null }],
    'Independent fixed DDL compiles the exact complete monitor index catalog row');
    const benefitNative = deedBenefitNativeProjection(Object.fromEntries(fields.map(field =>
      [field, deedBenefitNativeRows(reference, field)])), version);
    const storeRevenue = storeRevenueNativeProjection(reference.columns.filter(isStoreRevenueColumn), profile);
    return freeze({ ux, socialBridge, monitor, benefitNative, storeRevenue });
  } finally {
    await client?.end();
    if (created) {
      assert.equal((await pool.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1', [schema])).rows[0]?.mine, true);
      await pool.query('DROP SCHEMA ' + schema + ' CASCADE');
    }
  }
}
function storeRevenueNativeProjection(reference, profile) {
  const fresh = profile === 'fresh';
  assert.deepEqual(reference, [{ table_name: storeRevenueTable, column_name: storeRevenueColumn,
    ordinal: fresh ? 6 : 9, type: 'jsonb', typmod: -1, default_expression: null, not_null: false,
    identity: '', generated: '', collation_schema: null, collation_name: null }],
  'Independent Store DDL yields exactly the nullable JSONB receipt column at its fresh or upgrade ordinal');
  reference = freeze(structuredClone(reference));
  const projectColumns = columns => {
    assert.deepEqual(columns.filter(isStoreRevenueColumn), reference, 'The complete Store receipt column remains exact before historical projection');
    let shifted = 0;
    const projected = columns.filter(row => !isStoreRevenueColumn(row)).map(row => {
      const index = row.table_name === storeRevenueTable ? storeTrailingColumns.indexOf(row.column_name) : -1;
      if (!fresh || index < 0) return row;
      assert.equal(row.ordinal, index + 7, 'Only the three exact fresh Store columns follow the new receipt column');
      shifted++; return { ...row, ordinal: row.ordinal - 1 };
    });
    assert.equal(shifted, fresh ? 3 : 0);
    return projected;
  };
  const projectMetadata = metadata => ({ ...metadata, columns: projectColumns(metadata.columns) });
  const extendReference = base => {
    assert.deepEqual(base.columns.filter(row => row.table_name === storeRevenueTable).map(row => [row.column_name, row.ordinal]),
      ['nonce', 'sku', 'payer_address', 'amount_wei', 'tx_hash', ...storeTrailingColumns].map((name, index) => [name, index + 1]),
      'The unchanged historical oracle has exactly the eight original Store columns');
    const columns = base.columns.map(row => fresh && row.table_name === storeRevenueTable && storeTrailingColumns.includes(row.column_name)
      ? { ...row, ordinal: row.ordinal + 1 } : row);
    const at = columns.findIndex(row => row.table_name === storeRevenueTable && row.column_name === (fresh ? 'tx_hash' : 'created_at'));
    assert(at >= 0); columns.splice(at + 1, 0, ...reference);
    return freeze({ ...base, columns });
  };
  return Object.freeze({ reference, projectColumns, projectMetadata, extendReference });
}
export function uxNativeProjection(reference) {
  reference = freeze(structuredClone(reference));
  assert.deepEqual(reference.relations.map(row => row.name), UX_NATIVE_TABLES);
  const projectMetadata = metadata => {
    for (const field of fields) assert.deepEqual(uxRows(metadata, field), reference[field], 'Exact independently compiled UX ' + field);
    return Object.fromEntries(fields.map(field => [field, metadata[field].filter(row => !names.has(tableOf(field, row)))]));
  };
  const constraints = includeNotNull => reference.constraints.filter(row => includeNotNull || row.type !== 'n')
    .map(({ table_name, name, definition }) => ({ table_name, name, definition }));
  const projectConstraints = (rows, includeNotNull = true) => {
    assert.equal(typeof includeNotNull, 'boolean');
    assert.deepEqual(rows.filter(row => names.has(row.table_name)), constraints(includeNotNull), 'Every UX constraint required by the original native profile remains exact');
    return rows.filter(row => !names.has(row.table_name));
  };
  return Object.freeze({ projectMetadata, projectConstraints });
}
function socialLegacyBridgeProjection(reference) {
  reference = freeze(structuredClone(reference));
  assert.equal(reference.columns.length, 2); assert.deepEqual(reference.columns.map(row => row.column_name),
    [socialBridgeColumn, socialProofContractColumn]);
  assert.equal(reference.relations.length + reference.indexes.length, 0);
  const projectMetadata = metadata => {
    for (const field of fields) assert.deepEqual(socialBridgeRows(metadata, field), reference[field],
      'Exact independently compiled social bridge ' + field);
    return Object.fromEntries(fields.map(field => [field, metadata[field].filter(row => !isSocialBridgeRow(field, row))]));
  };
  const constraints = includeNotNull => includeNotNull ? reference.constraints.map(
    ({ table_name, name, definition }) => ({ table_name, name, definition })) : [];
  const projectConstraints = (rows, includeNotNull = true) => {
    assert.equal(typeof includeNotNull, 'boolean');
    assert.deepEqual(rows.filter(row => row.table_name === socialBridgeTable && row.name === socialBridgeConstraint),
      constraints(includeNotNull), 'The exact social bridge constraint remains exact for the original native profile');
    return rows.filter(row => !(row.table_name === socialBridgeTable && row.name === socialBridgeConstraint));
  };
  return Object.freeze({ projectMetadata, projectConstraints });
}
export function monitorNativeProjection(reference) {
  reference = freeze(structuredClone(reference));
  assert.equal(reference.relations.length + reference.columns.length + reference.constraints.length, 0);
  assert.equal(reference.indexes.length, 1);
  assert(isMonitorIndexRow('indexes', reference.indexes[0]));
  const projectMetadata = metadata => {
    for (const field of fields) assert.deepEqual(monitorRows(metadata, field), reference[field],
      'Exact independently compiled monitor ' + field);
    return Object.fromEntries(fields.map(field => [field, metadata[field].filter(row => !isMonitorIndexRow(field, row))]));
  };
  return Object.freeze({ projectMetadata });
}
function extendCatalog(prior, ux, socialBridge, monitor, benefitNative, storeRevenue, branches = false) {
  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),
    monitorProjection = monitorNativeProjection(monitor),
    projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(
      uxProjection.projectMetadata(benefitNative.projectMetadata(storeRevenue.projectMetadata(metadata))))),
    base = branches ? prior.current : prior.reference, reference = storeRevenue.extendReference(benefitNative.extendReference(merge(base, socialBridge, ux, monitor)));
  const verifyMetadata = metadata => (branches ? prior.verify : prior.verifyMetadata)(projectMetadata(metadata));
  verifyMetadata(reference);
  const causal = { socialBridge: 0, socialProofContract: 0, ux: 0, monitor: 0 };
  assert.throws(() => { reference.columns.push({}); }, TypeError);
  for (const [label, extension, makeProjection] of [
    ['socialBridge', socialBridge, socialLegacyBridgeProjection], ['ux', ux, uxNativeProjection],
    ['monitor', monitor, monitorNativeProjection],
  ]) {
    const field = fields.find(field => extension[field].length), key = Object.keys(extension[field][0])[0];
    assert.throws(() => { extension[field][0][key] = 'tampered'; }, TypeError);
    const retained = structuredClone(extension), independent = makeProjection(retained);
    retained[field][0][key] = 'tampered';
    const integrated = benefitNative.extendReference(merge(base, label === 'socialBridge' ? retained : socialBridge,
      label === 'ux' ? retained : ux, label === 'monitor' ? retained : monitor));
    assert.throws(() => independent.projectMetadata(integrated), error => error?.code === 'ERR_ASSERTION'); causal[label]++;
  }
  verifyMetadata(reference);
  for (const [label, extension] of [['socialBridge', socialBridge], ['ux', ux], ['monitor', monitor]]) {
    for (const field of fields) for (const row of extension[field]) {
      const causalLabel = label === 'socialBridge' && field === 'columns'
        && row.column_name === socialProofContractColumn ? 'socialProofContract' : label;
      const at = reference[field].findIndex(candidate => candidate === row);
      const missing = { ...reference, [field]: [...reference[field]] }; missing[field].splice(at, 1);
      assert.throws(() => verifyMetadata(missing), error => error?.code === 'ERR_ASSERTION'); causal[causalLabel]++;
      const duplicate = { ...reference, [field]: [...reference[field], { ...row }] };
      assert.throws(() => verifyMetadata(duplicate), error => error?.code === 'ERR_ASSERTION'); causal[causalLabel]++;
      for (const key of Object.keys(row)) {
        const changed = { ...reference, [field]: [...reference[field]] }, value = row[key];
        changed[field][at] = { ...row, [key]: typeof value === 'boolean' ? !value : typeof value === 'number' ? value + 1 : Array.isArray(value) ? [...value, 'unknown'] : value === null ? 'unknown' : value + '__unknown' };
        assert.throws(() => verifyMetadata(changed), error => error?.code === 'ERR_ASSERTION'); causal[causalLabel]++;
      }
    }
  }
  const proofContract = socialBridge.columns.find(row => row.column_name === socialProofContractColumn);
  assert(proofContract); assert.equal(causal.socialProofContract, Object.keys(proofContract).length + 2,
    'Proof-contract missing, duplicate and every-field mutations are all refused');
  let deedBenefitCausal = 0;
  for (const field of fields) for (const row of benefitNative.reference[field]) {
    const at = reference[field].findIndex(candidate => candidate === row); assert(at >= 0);
    const reject = metadata => { assert.throws(() => verifyMetadata(metadata), error => error?.code === 'ERR_ASSERTION'); deedBenefitCausal++; };
    reject({ ...reference, [field]: reference[field].filter((_, index) => index !== at) });
    reject({ ...reference, [field]: [...reference[field], { ...row }] });
    for (const key of Object.keys(row)) {
      const value = row[key], changed = { ...row, [key]: typeof value === 'boolean' ? !value
        : typeof value === 'number' ? value + 1 : Array.isArray(value) ? [...value, 'unknown'] : value === null ? 'unknown' : value + '__unknown' };
      reject({ ...reference, [field]: reference[field].map((candidate, index) => index === at ? changed : candidate) });
    }
    const unknown = { ...row, [field === 'relations' ? 'name' : 'table_name']: '__unknown_deed_marker__' };
    reject({ ...reference, [field]: [...reference[field], unknown] });
  }
  let storeRevenueCausal = 0;
  const receipt = storeRevenue.reference[0], at = reference.columns.indexOf(receipt);
  assert(at >= 0);
  const rejectStore = columns => { assert.throws(() => verifyMetadata({ ...reference, columns }), error => error?.code === 'ERR_ASSERTION'); storeRevenueCausal++; };
  rejectStore(reference.columns.filter((_, index) => index !== at));
  rejectStore([...reference.columns, { ...receipt }]);
  for (const key of Object.keys(receipt)) {
    const value = receipt[key], changed = { ...receipt, [key]: typeof value === 'boolean' ? !value
      : typeof value === 'number' ? value + 1 : value === null ? 'unknown' : value + '__unknown' };
    rejectStore(reference.columns.map((row, index) => index === at ? changed : row));
  }
  for (const column of storeTrailingColumns) rejectStore(reference.columns.map(row =>
    row.table_name === storeRevenueTable && row.column_name === column ? { ...row, ordinal: row.ordinal + 1 } : row));
  assert.equal(storeRevenueCausal, Object.keys(receipt).length + 5, 'Store receipt missing, duplicate, every field and all three adjacent ordinal mutations are refused');
  const common = { ...prior, reference, verifyMetadata, socialBridgeReference: socialBridge,
    socialBridgeCausal: causal.socialBridge, socialProofContractCausal: causal.socialProofContract,
    uxReference: ux, uxSource: UX_SOURCE.revision, uxCausal: causal.ux,
    monitorReference: monitor, monitorCausal: causal.monitor,
    deedBenefitReference: benefitNative.reference, deedBenefitCausal,
    storeRevenueReference: storeRevenue.reference, storeRevenueCausal };
  if (branches) return Object.freeze({ ...common, current: reference, verify: verifyMetadata });
  return Object.freeze({ ...common, normalize: rows => prior.normalize(socialBridgeProjection.projectConstraints(
    uxProjection.projectConstraints(benefitNative.projectConstraints(rows, prior.includeNotNull), prior.includeNotNull), prior.includeNotNull)) });
}
function integratedSchemaSources(input) {
  const candidate = economyUxMergeCandidateHistoricalInput('schema.sql', input);
  const predecessor = qualifyUxSource('schema.sql', economyUxMergeMainHistoricalInput('schema.sql', input)).baselineText;
  assert.equal(economyHardeningSourceBaseline('schema.sql', candidate), predecessor,
    'Integrated economy and UX source parents must share the exact predecessor');
  return Object.freeze({ candidate, predecessor });
}
async function createArchivedComparisonCatalog(pool, endpoint, input, options) {
  const { candidate } = integratedSchemaSources(input);
  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);
  const { ux, socialBridge, monitor, benefitNative, storeRevenue } = await compileCurrentExtensionReference(pool, endpoint, options.legacyProfile);
  const prior = await original.createCommerceReleasePhase2MigrationCatalog(
    await projectedCaller(pool, ux, socialBridge, monitor, benefitNative, storeRevenue), endpoint, candidate, options);
  return extendCatalog(prior, ux, socialBridge, monitor, benefitNative, storeRevenue);
}
async function verifyArchivedComparisonBranches(pool, endpoint) {
  await assertNativeCaller(pool, endpoint, 'fresh', true);
  const { candidate } = integratedSchemaSources(archived582ComparisonSource());
  const { ux, socialBridge, monitor, benefitNative, storeRevenue } = await compileCurrentExtensionReference(pool, endpoint, 'fresh');
  const prior = await original.verifyCommerceNativeBranches(
    await projectedCaller(pool, ux, socialBridge, monitor, benefitNative, storeRevenue), endpoint, candidate);
  return extendCatalog(prior, ux, socialBridge, monitor, benefitNative, storeRevenue, true);
}


// Actual585 admission and additive native metadata layer. Archived582 is comparison-only.
import { QUESTING_CATALOG_BASELINE, QUESTING_CATALOG_SOURCE, QUESTING_CATALOG_TABLES,
  questingCatalogSource, verifyQuestingCatalogTables, questingCasinoCatalogProjection, questingCasinoCatalogRows,
  questingCasinoConstraintProjection, QUESTING_CASINO_DDL_CONTROLS } from './questing-enterprise-catalog.js';
import { QUESTING_ENTERPRISE_NATIVE_INPUTS as questDeclaration,
  assertQuestingEnterpriseTrackedInput, captureQuestingEnterpriseSource,
  assertQuestingEnterpriseStable } from './enterprise-native-questing.js';
import { fileURLToPath as questFileURLToPath } from 'node:url';
import path from 'node:path';

const questRoot = questFileURLToPath(new URL('../', import.meta.url));
const questNames = new Set(QUESTING_CATALOG_TABLES);
const questFields = ['relations', 'columns', 'constraints', 'indexes'];
const questStates = new WeakMap();
let questSourceCapture;
const questGit = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args],
  { cwd: questRoot, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
const questSha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const questBlob = bytes => crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
const questTable = (field, row) => field === 'relations' ? row.name : row.table_name;
const questSelect = metadata => Object.fromEntries(questFields.map(field =>
  [field, metadata[field].filter(row => questNames.has(questTable(field, row)))]));
function questShape(metadata) {
  assert(metadata && typeof metadata === 'object');
  assert.deepEqual(Object.keys(metadata).sort(), [...questFields].sort());
  for (const field of questFields) assert(Array.isArray(metadata[field]));
}
function questEntry(revision, file) {
  const line = questGit('ls-tree', '-z', revision, '--', file).toString('utf8');
  const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
  assert(match && match[3] === file, 'Exact regular actual-current native source entry');
  return { type: 'blob', mode: match[1], blob: match[2] };
}
export function assertQuestingPhase2SourceInputs() {
  assert.equal(arguments.length, 0); return phase2SourceInputs(false);
}
export function assertTaskPuzzlePhase2SourceInputs() {
  assert.equal(arguments.length, 0); return phase2SourceInputs(true);
}
function phase2SourceInputs(taskPuzzle) {
  assert.equal(process.execArgv.length, 0); assert.equal(process.argv.length, 3);
  const main = path.resolve(process.argv[1]);
  const caller = main === path.join(questRoot, 'test', 'phase2-postgres.js')
    ? 'test/phase2-postgres.js' : main === path.join(questRoot, 'test', 'director-migration.js')
      ? 'test/director-migration.js' : null;
  assert(caller, 'Only the actual canonical Phase2 or Director test entry');
  assert(caller === 'test/phase2-postgres.js' ? ['--definitions', '--lots'].includes(process.argv[2])
    : process.argv[2] === '--postgres');
  if (!questSourceCapture) questSourceCapture = captureQuestingEnterpriseSource();
  else assertQuestingEnterpriseStable(questSourceCapture);
  const inputs = ['schema.sql', 'tools/questing-ux-release-phase2-native-catalog.js',
    'tools/questing-enterprise-catalog.js', 'test/questing-ux-release-phase2-native-catalog-guard.js', caller,
    ...(taskPuzzle ? ['tools/task-puzzle-native-catalog.js', 'tools/task-puzzle-enterprise-catalog.js',
      'test/task-puzzle-native-catalog-guard.js', 'test/task-puzzle-native-integration-guard.js'] : [])];
  for (const file of inputs) {
    const current = questEntry('HEAD', file), authored = questEntry(questDeclaration.authoredRevision, file);
    assert.equal(questGit('ls-files', '--stage', '--', file).toString('utf8').trim(),
      current.mode + ' ' + current.blob + ' 0\t' + file, 'Actual native index equals HEAD');
    const committed = questGit('show', 'HEAD:' + file), physical = fs.readFileSync(path.join(questRoot, file));
    const stat = fs.lstatSync(path.join(questRoot, file)), text = committed.toString('utf8');
    assert(stat.isFile() && !stat.isSymbolicLink());
    assert(Buffer.from(text).equals(committed) && !text.includes('\r'));
    assert(physical.equals(committed) || physical.equals(Buffer.from(text.replaceAll('\n', '\r\n'))),
      'Complete actual native physical bytes equal HEAD');
    assert.equal(questBlob(committed), current.blob);
    assertQuestingEnterpriseTrackedInput(file, current, authored, committed);
  }
  const raw = fs.readFileSync(path.join(questRoot, 'schema.sql'), 'utf8').replaceAll('\r\n', '\n');
  if (taskPuzzle) taskPuzzleCatalogSource(raw);
  else assert.equal(questSha(raw), QUESTING_CATALOG_SOURCE.sha256);
  return raw;
}
function archived582ComparisonSource() {
  const text = questGit('show', QUESTING_CATALOG_BASELINE.revision + ':schema.sql').toString('utf8');
  assert.equal(questSha(text), QUESTING_CATALOG_BASELINE.sha256);
  assert.equal(questBlob(Buffer.from(text)), QUESTING_CATALOG_BASELINE.blob);
  return text;
}
function questActualInput(input) {
  const physical = assertQuestingPhase2SourceInputs();
  assert.equal(typeof input, 'string');
  const normal = input.replaceAll('\r\n', '\n');
  assert(!normal.includes('\r') && (input === normal || input === normal.replaceAll('\n', '\r\n')));
  assert.equal(normal, physical, 'Actual585 native DDL is the complete physical schema');
  return questingCatalogSource(physical);
}
async function questFlags(queryable, metadata) {
  const rows = (await queryable.query(
    "SELECT t.relname::text AS table_name,c.conname::text AS name,c.connoinherit AS no_inherit,c.conislocal AS is_local,c.coninhcount AS inheritance_count FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=current_schema() AND t.relname IN ($1,$2,$3) ORDER BY t.relname,c.conname",
    QUESTING_CATALOG_TABLES)).rows;
  const flags = new Map(rows.map(row => [row.table_name + '.' + row.name, row]));
  assert.equal(flags.size, rows.length);
  assert.equal(rows.length, metadata.constraints.filter(row => questNames.has(row.table_name)).length);
  const constraints = metadata.constraints.map(row => {
    if (!questNames.has(row.table_name)) return row;
    const observed = flags.get(row.table_name + '.' + row.name); assert(observed);
    assert.deepEqual(Object.keys(observed).sort(), ['table_name', 'name', 'no_inherit', 'is_local', 'inheritance_count'].sort());
    return { ...row, no_inherit: observed.no_inherit, is_local: observed.is_local, inheritance_count: observed.inheritance_count };
  });
  return { ...metadata, constraints };
}
async function questVersion(queryable) {
  const row = (await queryable.query("SELECT current_setting('server_version_num') AS version")).rows[0];
  const version = Math.floor(Number(row.version) / 10000); assert(version === 16 || version === 18); return version;
}
async function questOnlyRows(queryable, version) {
  // The four original typed catalog queries are restricted to the three exact new names.
  const restricted = { query: async (sql, values) => {
    if (sql === catalogQueries[0]) return queryable.query(sql, values);
    const field = catalogFields.get(sql); assert(field, 'Closed native quest metadata query');
    assert(values === undefined || Array.isArray(values) && values.length === 0);
    const anchor = 'WHERE n.nspname=current_schema()'; assert.equal(sql.split(anchor).length, 2);
    const qualifier = field === 'relations' ? 'c' : 't';
    const selected = sql.replace(anchor, anchor + ' AND ' + qualifier + '.relname IN ($1,$2,$3)');
    return queryable.query(selected, QUESTING_CATALOG_TABLES);
  } };
  const metadata = await questFlags(queryable, await original.readCommerceReleasePhase2Metadata(restricted));
  verifyQuestingCatalogTables(metadata, version); return metadata;
}
export async function readCommerceReleasePhase2Metadata(pool) {
  const metadata = await questFlags(pool, await readArchivedComparisonMetadata(pool));
  verifyQuestingCatalogTables(metadata, await questVersion(pool)); return metadata;
}
function questRawReference(full) {
  return { ...full, constraints: full.constraints.map(row => {
    const { no_inherit, is_local, inheritance_count, ...typed } = row;
    assert.equal(Object.keys(row).length, 17); return typed;
  }) };
}
async function compileQuestReference(pool, endpoint, addition, version) {
  const name = 'release_phase2_ref_' + crypto.randomBytes(8).toString('hex');
  let created = false, client, failure;
  try {
    assert.equal((await pool.query('SELECT nspname FROM pg_namespace WHERE nspname=$1', [name])).rows.length, 0);
    await pool.query('CREATE SCHEMA ' + name); created = true;
    const address = new URL(endpoint); address.searchParams.set('options',
      '-c search_path=' + name + ' -c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000');
    client = new pg.Client({ connectionString: address.toString() }); await client.connect();
    const settings = (await client.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];
    const parent = (await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];
    assert.equal(settings.schema, name); assert.equal(settings.database, parent.database); assert.equal(settings.role, parent.role);
    await client.query('CREATE TABLE accounts (id TEXT PRIMARY KEY); CREATE TABLE characters (id TEXT PRIMARY KEY);');
    await client.query(addition);
    const reference = await questOnlyRows(client, version);
    return freeze({ full: reference, raw: questRawReference(reference) });
  } catch (error) { failure = error; throw error; }
  finally {
    const failures = [];
    try { await client?.end(); } catch (error) { failures.push(error); }
    try {
      if (created) {
        assert.equal((await pool.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1', [name])).rows[0]?.mine, true);
        await pool.query('DROP SCHEMA ' + name + ' CASCADE');
      }
    } catch (error) { failures.push(error); }
    if (failures.length) { if (!failure) throw new AggregateError(failures, 'Native quest reference cleanup failed'); failure.cleanupFailures = failures.map(error => error.message); }
  }
}
function questProjectMetadata(metadata, reference, full) {
  questShape(metadata);
  if (full) verifyQuestingCatalogTables(metadata, reference.version);
  assert.deepEqual(questSelect(metadata), full ? reference.full : reference.raw,
    'Every complete actual quest-table native field qualifies before the archived comparison');
  return Object.fromEntries(questFields.map(field =>
    [field, metadata[field].filter(row => !questNames.has(questTable(field, row)))]));
}
async function questProjectedCaller(pool, reference, profile) {
  const wrap = async queryable => {
    questingCasinoCatalogProjection(await original.readCommerceReleasePhase2Metadata(queryable), reference.version, profile, false);
    const context = (await queryable.query(catalogQueries[0])).rows[0];
    return { query: async (sql, values) => {
      if (sql === catalogQueries[0]) {
        const actual = await questOnlyRows(queryable, reference.version);
        assert.deepEqual(actual, reference.full, 'Same-client native quest fields requalify before every catalog reread');
        questingCasinoCatalogProjection(await original.readCommerceReleasePhase2Metadata(queryable), reference.version, profile, false);
      }
      const result = await queryable.query(sql, values), field = catalogFields.get(sql);
      if (!field) return result;
      const selected = result.rows.filter(row => questNames.has(questTable(field, row))).map(row => {
        if (field !== 'indexes') return row;
        const anchor = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(anchor).length, 2);
        return { ...row, definition: row.definition.replace(anchor, ' ON $self.') };
      });
      assert.deepEqual(selected, reference.raw[field], 'Exact actual quest ' + field + ' qualifies before filtering');
      return { ...result, rows: questingCasinoCatalogRows(field,
        result.rows.filter(row => !questNames.has(questTable(field, row))), reference.version, profile, false) };
    } };
  };
  return { ...await wrap(pool), connect: async () => {
    const client = await pool.connect();
    try { return { ...await wrap(client), release: client.release.bind(client) }; }
    catch (error) { client.release(); throw error; }
  } };
}
function questConstraintProjection(rows, reference, includeNotNull) {
  assert(Array.isArray(rows));
  const expected = reference.full.constraints.filter(row => includeNotNull || row.type !== 'n')
    .map(({ table_name, name, definition }) => ({ table_name, name, definition }));
  const selected = rows.filter(row => questNames.has(row.table_name));
  assert.deepEqual(selected, expected, 'Every new quest constraint remains exact before old normalization');
  return rows.filter(row => !questNames.has(row.table_name));
}
const questOrder = rows => [...rows].sort((a, b) => a.table_name < b.table_name ? -1 : a.table_name > b.table_name ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
export function questingNativeQuestProjection(full, version, includeNotNull) {
  assert.equal(arguments.length, 3); assert.equal(typeof includeNotNull, 'boolean');
  questShape(full); verifyQuestingCatalogTables(full, version);
  const reference = freeze({ full: questSelect(structuredClone(full)), version });
  return Object.freeze({
    projectMetadata: metadata => questProjectMetadata(metadata, reference, true),
    projectConstraints: rows => questConstraintProjection(rows, reference, includeNotNull),
    sourceOnly: true, nativeAdmission: false, priorResultsTransferred: false,
  });
}
export function questingNativeCatalogProjection(full, version, includeNotNull, profile) {
  assert.equal(arguments.length, 4);
  const quest = questingNativeQuestProjection(full, version, includeNotNull);
  return Object.freeze({ projectMetadata: metadata => questingCasinoCatalogProjection(quest.projectMetadata(metadata), version, profile, false),
    projectConstraints: rows => questingCasinoConstraintProjection(quest.projectConstraints(rows), version, includeNotNull),
    sourceOnly: true, nativeAdmission: false, priorResultsTransferred: false });
}
function extendQuestCatalog(prior, reference, projected, includeNotNull, current, ddlCausal, profile, casinoDdlCausal) {
  const projection = questingNativeCatalogProjection(reference.full, reference.version, includeNotNull, profile);
  const project = projection.projectMetadata;
  const normalize = typeof prior.normalize === 'function'
    ? rows => prior.normalize(projection.projectConstraints(rows)) : null;
  const verifyMetadata = metadata => prior.verifyMetadata(project(metadata));
  verifyMetadata(current); freeze(current);
  const result = Object.freeze({ ...prior, ...(normalize ? { normalize } : {}), verifyMetadata,
    ...(prior.verify ? { verify: metadata => prior.verify(project(metadata)) } : {}),
    reference: current, ...(prior.current ? { current } : {}),
    archived582Reference: prior.reference, questReference: reference.full, questDdlCausal: ddlCausal, casinoDdlCausal,
    phase: 'Actual585 live metadata with separately qualified archived582 parent comparison; ' + prior.phase,
    questPhase: 'Actual585 native quest rows; exact archived582 comparison only' });
  questStates.set(result, { prior, reference, projected, includeNotNull, profile }); return result;
}
async function casinoDdlControls(pool, version, profile) {
  let causal = 0; const client = await pool.connect();
  try {
    for (const ddl of QUESTING_CASINO_DDL_CONTROLS) {
      await client.query('BEGIN');
      try {
        questingCasinoCatalogProjection(await original.readCommerceReleasePhase2Metadata(client), version, profile, false);
        await client.query(ddl);
        await assert.rejects(async () => questingCasinoCatalogProjection(await original.readCommerceReleasePhase2Metadata(client), version, profile, false),
          error => error?.code === 'ERR_ASSERTION'); causal++;
      } finally { await client.query('ROLLBACK'); }
      questingCasinoCatalogProjection(await original.readCommerceReleasePhase2Metadata(client), version, profile, false);
    }
  } finally { client.release(); }
  assert.equal(causal, 14); return causal;
}
async function questDdlControls(pool, reference) {
  const ddls = [
    ...QUESTING_CATALOG_TABLES.map(table => 'ALTER TABLE ' + table + ' ADD COLUMN unreviewed TEXT'),
    'ALTER TABLE quest_workshop_mysteries DROP CONSTRAINT quest_workshop_mysteries_author_account_id_fkey',
    'ALTER TABLE quest_workshop_plays DROP CONSTRAINT quest_workshop_plays_mystery_id_fkey',
    'ALTER TABLE quest_workshop_plays DROP CONSTRAINT quest_workshop_plays_account_id_fkey',
    'ALTER TABLE quest_reading_room DROP CONSTRAINT quest_reading_room_account_id_fkey',
    'ALTER TABLE quest_workshop_mysteries DROP CONSTRAINT quest_workshop_mysteries_status_check',
    'ALTER TABLE quest_workshop_plays DROP CONSTRAINT quest_workshop_plays_stars_check',
    'ALTER TABLE quest_workshop_mysteries ALTER COLUMN author_credit DROP NOT NULL',
    'ALTER TABLE quest_workshop_plays ALTER COLUMN attempts SET DEFAULT 42',
    'DROP INDEX ix_quest_workshop_author',
    'DROP INDEX ix_quest_workshop_published',
    'ALTER TABLE quest_workshop_plays ALTER CONSTRAINT quest_workshop_plays_account_id_fkey DEFERRABLE',
    'ALTER TABLE quest_workshop_mysteries ALTER CONSTRAINT quest_workshop_mysteries_author_account_id_fkey DEFERRABLE',
  ];
  let causal = 0;
  const client = await pool.connect();
  try {
    for (const ddl of ddls) {
      await client.query('BEGIN');
      try {
        assert.deepEqual(await questOnlyRows(client, reference.version), reference.full);
        await client.query(ddl);
        await assert.rejects(() => questOnlyRows(client, reference.version),
          error => error?.code === 'ERR_ASSERTION');
        causal++;
      } finally { await client.query('ROLLBACK'); }
      assert.deepEqual(await questOnlyRows(client, reference.version), reference.full,
        'Every actual quest DDL probe restores exact same-client native fields');
    }
  } finally { client.release(); }
  assert.equal(causal, 15);
  return causal;
}
export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options) {
  assert.equal(arguments.length, 4);
  const actual = questActualInput(input);
  return createQuestCatalogComparison(pool, endpoint, actual, options);
}
async function createQuestCatalogComparison(pool, endpoint, actual, options) {
  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);
  const version = await questVersion(pool), compiled = await compileQuestReference(pool, endpoint, actual.addition, version);
  const reference = freeze({ ...compiled, version });
  assert.deepEqual(await questOnlyRows(pool, version), reference.full);
  const ddlCausal = await questDdlControls(pool, reference);
  const casinoDdlCausal = await casinoDdlControls(pool, version, options.legacyProfile);
  const projected = await questProjectedCaller(pool, reference, options.legacyProfile);
  const prior = await createArchivedComparisonCatalog(projected, endpoint, archived582ComparisonSource(), options);
  const current = await readCommerceReleasePhase2Metadata(pool);
  assertQuestingEnterpriseStable(questSourceCapture);
  return extendQuestCatalog(prior, reference, projected, options.includeNotNull, current, ddlCausal, options.legacyProfile, casinoDdlCausal);
}
export async function verifyCommerceNativeBranches(pool, endpoint) {
  assert.equal(arguments.length, 2);
  const actual = questActualInput(fs.readFileSync(path.join(questRoot, 'schema.sql'), 'utf8'));
  return verifyQuestCatalogComparison(pool, endpoint, actual);
}
async function verifyQuestCatalogComparison(pool, endpoint, actual) {
  await assertNativeCaller(pool, endpoint, 'fresh', true);
  const version = await questVersion(pool), compiled = await compileQuestReference(pool, endpoint, actual.addition, version);
  const reference = freeze({ ...compiled, version });
  assert.deepEqual(await questOnlyRows(pool, version), reference.full);
  const ddlCausal = await questDdlControls(pool, reference);
  const casinoDdlCausal = await casinoDdlControls(pool, version, 'fresh');
  const projected = await questProjectedCaller(pool, reference, 'fresh');
  const prior = await verifyArchivedComparisonBranches(projected, endpoint);
  const current = await readCommerceReleasePhase2Metadata(pool);
  assertQuestingEnterpriseStable(questSourceCapture);
  return extendQuestCatalog(prior, reference, projected, true, current, ddlCausal, 'fresh', casinoDdlCausal);
}
export async function verifyCommerceReleasePhase2CausalNegatives(pool, catalog, rows, verifyRows) {
  assert.equal(arguments.length, 4);
  const state = questStates.get(catalog); assert(state, 'Only the actual-current catalog returned by this native invocation');
  const { prior, reference, projected, includeNotNull } = state;
  assert.deepEqual(await questOnlyRows(pool, reference.version), reference.full);
  const withoutQuest = questConstraintProjection(rows, reference, includeNotNull);
  const parentRows = questingCasinoConstraintProjection(withoutQuest, reference.version, includeNotNull);
  const casinoRows = withoutQuest.filter(row => !parentRows.includes(row));
  const questRows = rows.filter(row => questNames.has(row.table_name));
  const result = await original.verifyCommerceReleasePhase2CausalNegatives(projected, prior, parentRows,
    candidate => verifyRows(questOrder([...candidate, ...questRows, ...casinoRows])));
  assert.deepEqual(await questOnlyRows(pool, reference.version), reference.full);
  assertQuestingEnterpriseStable(questSourceCapture);
  return result;
}

// Distinct current586 admission; the old exported585 entrypoints above remain strict.
import { taskPuzzleCatalogSource, verifyTaskPuzzleCatalogDelta, taskPuzzleComparisonMetadata,
  taskPuzzleComparisonConstraints, readTaskPuzzleSequenceMetadata, compileTaskPuzzleCallerReferences,
  TASK_PUZZLE_DDL_CONTROLS } from './task-puzzle-native-catalog.js';
import { isDeepStrictEqual } from 'node:util';
const taskStates=new WeakMap(),taskProfiles=new WeakMap();
function taskActualInput(input){
  const physical=assertTaskPuzzlePhase2SourceInputs(),actual=taskPuzzleCatalogSource(input);
  assert.equal(actual.current,physical,'Native current586 input is the complete actual physical schema');return actual;
}
async function taskMetadata(client){
  return {...await readCommerceReleasePhase2Metadata(client),sequences:await readTaskPuzzleSequenceMetadata(client)};
}
export async function readTaskPuzzleReleasePhase2Metadata(pool){
  assert.equal(arguments.length,1);assertTaskPuzzlePhase2SourceInputs();
  const profile=taskProfiles.get(pool);assert(profile,'Only a pool admitted by a current586 native catalog');
  const metadata=await taskMetadata(pool);verifyTaskPuzzleCatalogDelta(metadata,await questVersion(pool),profile,false);return metadata;
}
export async function readTaskPuzzleDeltaMetadata(queryable){
  assert.equal(arguments.length,1);
  const restricted={query:async(sql,values)=>{
    assert(values===undefined||Array.isArray(values)&&values.length===0,'Closed task delta query parameters');
    if(sql===catalogQueries[0])return queryable.query(sql,values);
    const field=catalogFields.get(sql);assert(field,'Closed task delta metadata query');
    const anchor='WHERE n.nspname=current_schema()';assert.equal(sql.split(anchor).length,2);
    return queryable.query(sql.replace(anchor,anchor+' AND '+(field==='relations'?'c':'t')+'.relname IN ($1,$2,$3)'),
      ['characters','task_puzzles','task_puzzles_issue_order_seq']);
  }};
  return {...await original.readCommerceReleasePhase2Metadata(restricted),sequences:await readTaskPuzzleSequenceMetadata(queryable)};
}
async function taskProjectedCaller(pool,version,profile){
  const wrap=async queryable=>{
    const qualify=async()=>{const metadata=await readTaskPuzzleDeltaMetadata(queryable);verifyTaskPuzzleCatalogDelta(metadata,version,profile,false);return metadata;};
    await qualify();const context=(await queryable.query(catalogQueries[0])).rows[0];
    return {query:async(sql,values)=>{
      const field=catalogFields.get(sql),metadata=field||sql===catalogQueries[0]?await qualify():null;
      const result=await queryable.query(sql,values);if(!field)return result;
      const rows=field==='indexes'?result.rows.map(row=>{const anchor=' ON '+context.schema+'.';assert.equal(row.definition.split(anchor).length,2);return {...row,definition:row.definition.replace(anchor,' ON $self.')};}):result.rows;
      const projected=taskPuzzleComparisonMetadata({...metadata,[field]:rows},version,profile,false)[field];
      return {...result,rows:field==='indexes'?projected.map(row=>({...row,definition:row.definition.replace(' ON $self.',' ON '+context.schema+'.')})):projected};
    }};
  };
  return {...await wrap(pool),connect:async()=>{const client=await pool.connect();try{return {...await wrap(client),release:client.release.bind(client)};}catch(error){client.release();throw error;}}};
}
async function taskDdlControls(pool,version,profile){
  const client=await pool.connect();let causal=0;
  try{
    const originalMetadata=await taskMetadata(client);verifyTaskPuzzleCatalogDelta(originalMetadata,version,profile,false);
    for(const ddl of TASK_PUZZLE_DDL_CONTROLS){
      await client.query('BEGIN');try{await client.query(ddl);await assert.rejects(async()=>assert(isDeepStrictEqual(await taskMetadata(client),originalMetadata),'Complete current task DDL metadata'),error=>error?.code==='ERR_ASSERTION');causal++;}finally{await client.query('ROLLBACK');}
      const restored=await taskMetadata(client);verifyTaskPuzzleCatalogDelta(restored,version,profile,false);assert.deepEqual(restored,originalMetadata,'Exact same-client task DDL rollback reread');
    }
  }finally{client.release();}return causal;
}
function extendTaskCatalog(prior,current,version,profile,includeNotNull,projected,references,ddlCausal){
  assert.equal(references.scope,'independent-positive-current586-references');
  assert.deepEqual(references.referenceDdl,{status:'not-run',owner:'test/enterprise-release-phase2-migration-catalog.js --postgres'});
  assert.equal(references.actualTables,586);assert.equal(references.baselineTables,585);assert.equal(references.idempotent,2);assert.equal(ddlCausal,47);
  const project=metadata=>taskPuzzleComparisonMetadata(metadata,version,profile,false);
  const verifyMetadata=metadata=>{const result=project(metadata);prior.verifyMetadata(result);assert.deepEqual(metadata,current,'Complete admitted current586 catalog');return true;};
  verifyMetadata(current);freeze(current);
  const result=Object.freeze({...prior,reference:current,...(prior.current?{current}:{}),verifyMetadata,
    ...(prior.verify?{verify:verifyMetadata}:{}),
    ...(prior.normalize?{normalize:rows=>prior.normalize(taskPuzzleComparisonConstraints(rows,version,includeNotNull,profile))}:{}),
    actualTables:586,taskPuzzleReferences:references,taskPuzzleDdlCausal:ddlCausal,
    phase:'Actual586 live profile catalog with independently compiled positive raw references; reference DDL adversarial proof is a separate Enterprise obligation; '+prior.phase});
  taskStates.set(result,{prior,projected,version,profile,includeNotNull,current});return result;
}
export async function createTaskPuzzleReleasePhase2MigrationCatalog(pool,endpoint,input,options){
  assert.equal(arguments.length,4);const actual=taskActualInput(input);
  await assertNativeCaller(pool,endpoint,options?.legacyProfile,options?.includeNotNull);
  const profile=options.legacyProfile;assert(['phase2','director'].includes(profile));const version=await questVersion(pool);
  const before=await taskMetadata(pool);verifyTaskPuzzleCatalogDelta(before,version,profile,false);
  const references=await compileTaskPuzzleCallerReferences(pool,endpoint,actual.current),ddlCausal=await taskDdlControls(pool,version,profile);
  const projected=await taskProjectedCaller(pool,version,profile);
  const prior=await createQuestCatalogComparison(projected,endpoint,actual.quest,options);
  taskProfiles.set(pool,profile);const current=await readTaskPuzzleReleasePhase2Metadata(pool);assertQuestingEnterpriseStable(questSourceCapture);
  return extendTaskCatalog(prior,current,version,profile,options.includeNotNull,projected,references,ddlCausal);
}
export async function verifyTaskPuzzleNativeBranches(pool,endpoint){
  assert.equal(arguments.length,2);const actual=taskActualInput(fs.readFileSync(path.join(questRoot,'schema.sql'),'utf8'));
  await assertNativeCaller(pool,endpoint,'fresh',true);const version=await questVersion(pool);
  verifyTaskPuzzleCatalogDelta(await taskMetadata(pool),version,'fresh',false);
  const references=await compileTaskPuzzleCallerReferences(pool,endpoint,actual.current),ddlCausal=await taskDdlControls(pool,version,'fresh');
  const projected=await taskProjectedCaller(pool,version,'fresh'),prior=await verifyQuestCatalogComparison(projected,endpoint,actual.quest);
  taskProfiles.set(pool,'fresh');const current=await readTaskPuzzleReleasePhase2Metadata(pool);assertQuestingEnterpriseStable(questSourceCapture);
  return extendTaskCatalog(prior,current,version,'fresh',true,projected,references,ddlCausal);
}
export async function verifyTaskPuzzleReleasePhase2CausalNegatives(pool,catalog,rows,verifyRows){
  assert.equal(arguments.length,4);const state=taskStates.get(catalog);assert(state,'Only this invocation\'s actual current586 catalog');assertTaskPuzzlePhase2SourceInputs();
  const {prior,projected,version,profile,includeNotNull,current}=state;
  assert.deepEqual(await taskMetadata(pool),current);
  const parentRows=taskPuzzleComparisonConstraints(rows,version,includeNotNull,profile),addedRows=rows.filter(row=>!parentRows.includes(row));
  const result=await verifyCommerceReleasePhase2CausalNegatives(projected,prior,parentRows,candidate=>verifyRows(questOrder([...candidate,...addedRows])));
  assert.deepEqual(await taskMetadata(pool),current);assertQuestingEnterpriseStable(questSourceCapture);return result;
}
