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
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
// Keep the original engine's exact predecessor order; insert the existing-table bridge at its exact
// catalog anchors, then retain the reviewed UX append order. No collation normalization is introduced.
const merge = (base, socialBridge, ux) => {
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
async function projectedCaller(pool, ux, socialBridge, benefitNative) {
  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge);
  const projectMetadata = metadata => socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(benefitNative.projectMetadata(metadata)));
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
    let benefitRows = deedBenefitNativeRows({ [field]: result.rows }, field);
    if (field === 'indexes') benefitRows = benefitRows.map(row => {
      const prefix = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(prefix).length, 2);
      return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };
    });
    assert.deepEqual(benefitRows, benefitNative.reference[field], 'Every fresh projected SQL result retains the complete current marker ' + field);
    if (guarded) { await assertUxNativeSecurity(pool); await assertDeedBenefitNativeSecurity(pool); }
    return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row)
      && tableOf(field, row) !== DEED_BENEFIT_NATIVE_TABLE) };
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
export async function readCommerceReleasePhase2Metadata(pool) {
  const metadata = await original.readCommerceReleasePhase2Metadata(pool);
  await assertUxNativeSecurity(pool); await assertDeedBenefitNativeSecurity(pool); return metadata;
}
async function compileCurrentExtensionReference(pool, endpoint) {
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
    await assertDeedBenefitNativeMigration();
    await client.query('CREATE TABLE characters (id TEXT PRIMARY KEY);\n' + DEED_BENEFIT_NATIVE_DDL + ';\n' + socialBridgeDdl + '\n' + uxDdl);
    const reference = await original.readCommerceReleasePhase2Metadata(client);
    assert.deepEqual(reference.relations.map(row => row.name), ['characters', socialBridgeTable, DEED_BENEFIT_NATIVE_TABLE, ...UX_NATIVE_TABLES],
      'Independent immutable DDL creates exactly the FK target, current marker, social bridge fixture and seven UX tables');
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
    const benefitNative = deedBenefitNativeProjection(Object.fromEntries(fields.map(field =>
      [field, deedBenefitNativeRows(reference, field)])), version);
    return freeze({ ux, socialBridge, benefitNative });
  } finally {
    await client?.end();
    if (created) {
      assert.equal((await pool.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1', [schema])).rows[0]?.mine, true);
      await pool.query('DROP SCHEMA ' + schema + ' CASCADE');
    }
  }
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
function extendCatalog(prior, ux, socialBridge, benefitNative, branches = false) {
  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),
    projectMetadata = metadata => socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(benefitNative.projectMetadata(metadata))),
    base = branches ? prior.current : prior.reference, reference = benefitNative.extendReference(merge(base, socialBridge, ux));
  const verifyMetadata = metadata => (branches ? prior.verify : prior.verifyMetadata)(projectMetadata(metadata));
  verifyMetadata(reference);
  const causal = { socialBridge: 0, socialProofContract: 0, ux: 0 };
  assert.throws(() => { reference.columns.push({}); }, TypeError);
  for (const [label, extension, makeProjection] of [
    ['socialBridge', socialBridge, socialLegacyBridgeProjection], ['ux', ux, uxNativeProjection],
  ]) {
    assert.throws(() => { extension.columns[0].type = 'tampered'; }, TypeError);
    const retained = structuredClone(extension), independent = makeProjection(retained);
    retained.columns[0].type = 'tampered';
    const integrated = benefitNative.extendReference(label === 'socialBridge' ? merge(base, retained, ux) : merge(base, socialBridge, retained));
    assert.throws(() => independent.projectMetadata(integrated), error => error?.code === 'ERR_ASSERTION'); causal[label]++;
  }
  verifyMetadata(reference);
  for (const [label, extension] of [['socialBridge', socialBridge], ['ux', ux]]) {
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
  const common = { ...prior, reference, verifyMetadata, socialBridgeReference: socialBridge,
    socialBridgeCausal: causal.socialBridge, socialProofContractCausal: causal.socialProofContract,
    uxReference: ux, uxSource: UX_SOURCE.revision, uxCausal: causal.ux,
    deedBenefitReference: benefitNative.reference, deedBenefitCausal };
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
export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options) {
  const { candidate } = integratedSchemaSources(input);
  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);
  const { ux, socialBridge, benefitNative } = await compileCurrentExtensionReference(pool, endpoint);
  const prior = await original.createCommerceReleasePhase2MigrationCatalog(
    await projectedCaller(pool, ux, socialBridge, benefitNative), endpoint, candidate, options);
  return extendCatalog(prior, ux, socialBridge, benefitNative);
}
export async function verifyCommerceNativeBranches(pool, endpoint) {
  await assertNativeCaller(pool, endpoint, 'fresh', true);
  const { candidate } = integratedSchemaSources(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const { ux, socialBridge, benefitNative } = await compileCurrentExtensionReference(pool, endpoint);
  const prior = await original.verifyCommerceNativeBranches(
    await projectedCaller(pool, ux, socialBridge, benefitNative), endpoint, candidate);
  return extendCatalog(prior, ux, socialBridge, benefitNative, true);
}
