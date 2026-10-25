// Exact current UX extension. Original Commerce/Deed native sources and assertions remain intact.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
import pg from 'pg';
import * as original from './commerce-deed-release-phase2-native-catalog.js';
import { UX_SOURCE, qualifyUxSource } from './ux-source-compatibility.js';
export * from './commerce-deed-release-phase2-native-catalog.js';

export const UX_NATIVE_TABLES = Object.freeze(['ux_community_documents', 'ux_community_entries', 'ux_community_portrait_consents', 'ux_crew_notes', 'ux_crew_signals', 'ux_mentor_subjects', 'ux_workspaces']);
const names = new Set(UX_NATIVE_TABLES), fields = ['relations', 'columns', 'constraints', 'indexes'];
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
const currentSchema = git('show', UX_SOURCE.revision + ':schema.sql');
const predecessorSchema = qualifyUxSource('schema.sql', currentSchema).baselineText;
assert(currentSchema.startsWith(predecessorSchema), 'The reviewed UX schema is a literal append only');
const uxDdl = currentSchema.slice(predecessorSchema.length);
assert.deepEqual([...uxDdl.matchAll(/^CREATE TABLE IF NOT EXISTS (\w+) /gm)].map(match => match[1]).sort(), UX_NATIVE_TABLES);
assert(!/\b(?:ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(uxDdl), 'Only the seven inert table/index definitions');
const tableOf = (field, row) => field === 'relations' ? row.name : row.table_name;
const uxRows = (metadata, field) => metadata[field].filter(row => names.has(tableOf(field, row)));
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
// Keep the original engine's exact predecessor order; no collation normalization is introduced.
const merge = (base, ux) => freeze(Object.fromEntries(fields.map(field => [field, [...base[field], ...ux[field]]])));

// The unchanged historical constructor also reads its caller's catalog internally. Only its four
// exact, immutable catalog SELECTs get the validated UX projection; all other queries stay real.
assert.equal(fs.readFileSync(new URL('./commerce-deed-release-phase2-native-catalog.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n'),
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
async function assertNativeCaller(pool, endpoint) {
  const address = new URL(endpoint), local = ['35439', '35449'].includes(address.port) && address.username === 'pilot_runner' && !address.password,
    ci = address.port === '5432' && address.username === 'postgres' && address.password === 'pgcheck';
  assert(['postgres:', 'postgresql:'].includes(address.protocol) && address.hostname === '127.0.0.1' && !address.search && !address.hash && (local || ci));
  assert(['/omerta_check', '/omerta_query'].includes(address.pathname));
  const main = String(process.argv[1]).replaceAll('\\', '/');
  assert(main.endsWith('/test/phase2-postgres.js')); assert(['--definitions', '--lots'].includes(process.argv[2]));
  assert.equal(process.env.P2_TEST_CHILD, process.argv[2] === '--definitions' ? 'upgrade' : 'lots');
  const settings = (await pool.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];
  assert.match(settings.schema, /^p2_definitions_[a-f0-9]{32}$/); assert.equal(settings.schema, process.env.P2_TEST_SCHEMA);
  assert.equal(settings.role, address.username); assert.equal('/' + settings.database, address.pathname);
}
async function projectedCaller(pool, ux) {
  const projection = uxNativeProjection(ux);
  const context = (await pool.query(catalogQueries[0])).rows[0];
  const verify = async () => { projection.projectMetadata(await original.readCommerceReleasePhase2Metadata(pool)); await assertUxNativeSecurity(pool); };
  await verify();
  return { query: async (sql, values) => {
    if (sql === catalogQueries[0]) await verify();
    const result = await pool.query(sql, values), field = catalogFields.get(sql);
    if (!field) return result;
    let selected = result.rows.filter(row => names.has(tableOf(field, row)));
    if (field === 'indexes') selected = selected.map(row => {
      const prefix = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(prefix).length, 2);
      return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };
    });
    assert.deepEqual(selected, ux[field], 'Every fresh projected SQL result retains the complete UX ' + field);
    await assertUxNativeSecurity(pool);
    return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row))) };
  }, connect: pool.connect.bind(pool) };
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
  await assertUxNativeSecurity(pool); return metadata;
}
async function compileUxReference(pool, endpoint) {
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
    await client.query(uxDdl);
    const reference = await original.readCommerceReleasePhase2Metadata(client);
    assert.deepEqual(reference.relations.map(row => row.name), UX_NATIVE_TABLES, 'Independent immutable DDL creates exactly the seven UX tables');
    return freeze(reference);
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
  const expectedConstraints = reference.constraints.map(({ table_name, name, definition }) => ({ table_name, name, definition }));
  const projectConstraints = rows => {
    assert.deepEqual(rows.filter(row => names.has(row.table_name)), expectedConstraints, 'Every UX primary key and native NOT NULL constraint remains exact');
    return rows.filter(row => !names.has(row.table_name));
  };
  return Object.freeze({ projectMetadata, projectConstraints });
}
function extendCatalog(prior, ux, branches = false) {
  const projection = uxNativeProjection(ux), base = branches ? prior.current : prior.reference, reference = merge(base, ux);
  const verifyMetadata = metadata => (branches ? prior.verify : prior.verifyMetadata)(projection.projectMetadata(metadata));
  verifyMetadata(reference);
  let causal = 0;
  assert.throws(() => { reference.columns.push({}); }, TypeError);
  assert.throws(() => { ux.columns[0].type = 'tampered'; }, TypeError);
  const retained = structuredClone(ux), independent = uxNativeProjection(retained);
  retained.columns[0].type = 'tampered';
  assert.throws(() => independent.projectMetadata(merge(base, retained)), error => error?.code === 'ERR_ASSERTION'); causal++;
  verifyMetadata(reference);
  for (const field of fields) for (const row of ux[field]) {
    const at = reference[field].findIndex(candidate => candidate === row);
    const missing = { ...reference, [field]: [...reference[field]] }; missing[field].splice(at, 1);
    assert.throws(() => projection.projectMetadata(missing), error => error?.code === 'ERR_ASSERTION'); causal++;
    const duplicate = { ...reference, [field]: [...reference[field], { ...row }] }; assert.throws(() => projection.projectMetadata(duplicate), error => error?.code === 'ERR_ASSERTION'); causal++;
    for (const key of Object.keys(row)) {
      const changed = { ...reference, [field]: [...reference[field]] }, value = row[key];
      changed[field][at] = { ...row, [key]: typeof value === 'boolean' ? !value : typeof value === 'number' ? value + 1 : Array.isArray(value) ? [...value, 'unknown'] : value === null ? 'unknown' : value + '__unknown' };
      assert.throws(() => projection.projectMetadata(changed), error => error?.code === 'ERR_ASSERTION'); causal++;
    }
  }
  const common = { ...prior, reference, verifyMetadata, uxReference: ux, uxSource: UX_SOURCE.revision, uxCausal: causal };
  if (branches) return Object.freeze({ ...common, current: reference, verify: verifyMetadata });
  return Object.freeze({ ...common, normalize: rows => prior.normalize(projection.projectConstraints(rows)) });
}
export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options) {
  const predecessor = qualifyUxSource('schema.sql', input).baselineText;
  await assertNativeCaller(pool, endpoint);
  const ux = await compileUxReference(pool, endpoint);
  const prior = await original.createCommerceReleasePhase2MigrationCatalog(await projectedCaller(pool, ux), endpoint, predecessor, options);
  return extendCatalog(prior, ux);
}
export async function verifyCommerceNativeBranches(pool, endpoint) {
  await assertNativeCaller(pool, endpoint);
  const ux = await compileUxReference(pool, endpoint);
  const prior = await original.verifyCommerceNativeBranches(await projectedCaller(pool, ux), endpoint);
  return extendCatalog(prior, ux, true);
}
