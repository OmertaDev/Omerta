// Current587 is a distinct source/catalog admission. Historical586 is comparison-only.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { captureQuestingEnterpriseSource, assertQuestingEnterpriseStable } from './enterprise-native-questing.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const blob = value => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest('hex');
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const fields = ['relations', 'columns', 'constraints', 'indexes'];
const shape = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), 'Closed complete C3 catalog shape');
const git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 32e6 });
export const DEED_PRIMARY_CATALOG_SOURCE = freeze({ file: 'schema.sql', mode: '100755', blob: '538b702ca8c5cd39534c69835d62ecd07bc10d2e', sha256: 'fcd12b36f4c322ecbd5d6573f8ae780ce80a793b4911ea07d3268d4ab9861c90' });
export const DEED_PRIMARY_CATALOG_PREDECESSOR = freeze({ file: 'schema.sql', mode: '100755', blob: '511950e2a68d50cebebe6139098a5dbb609117c9', sha256: 'b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de' });
const streetAnchor = 'CREATE UNIQUE INDEX IF NOT EXISTS ix_street_deeds_building ON street_deeds (building_id);\n';
const c3Ddl = `-- Prospective provenance only. Legacy allocation/backfill is not evidence of payment or eligibility.
ALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS issuance_kind TEXT CHECK (issuance_kind IN ('gameplay','paid','partnership'));
ALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS primary_issuance_receipt JSONB;
ALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS last_burn_receipt JSONB;
ALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS last_extraction_receipt JSONB;
-- An unpaid intent grants no street, home, rent, stock target or permanent supply assignment.
-- Never copy these rows into street_deeds until the confirmed first-payment receipt is verified.
CREATE TABLE IF NOT EXISTS street_deed_paid_intents (
  account_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_lc TEXT NOT NULL UNIQUE,
  district TEXT NOT NULL,
  building_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
const burnAnchor = `CREATE TABLE IF NOT EXISTS deed_reimports (
  ref TEXT PRIMARY KEY,                             -- txHash:logIndex (idempotency)
  wallet_address TEXT NOT NULL,                     -- the burner (Redeemed.from), checksummed
  token_id TEXT NOT NULL,                           -- the burned deed tokenId (keccak(name), decimal string)
  status TEXT NOT NULL DEFAULT 'pending',           -- 'pending' | 'applied'
  applied_account TEXT,                             -- the account the deed was re-keyed to
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ
);
`;
const burnDdl = 'ALTER TABLE deed_reimports ADD COLUMN IF NOT EXISTS burn_receipt JSONB;\n';
export function deedPrimaryCatalogSource(input) {
  assert.equal(arguments.length, 1); assert.equal(typeof input, 'string');
  const current = input.replaceAll('\r\n', '\n');
  assert(!current.includes('\r') && (input === current || input === current.replaceAll('\n', '\r\n')), 'Whole uniform LF/CRLF only');
  assert.equal(sha(current), DEED_PRIMARY_CATALOG_SOURCE.sha256, 'Exact complete actual deed-primary587 schema');
  assert.equal(blob(current), DEED_PRIMARY_CATALOG_SOURCE.blob);
  const predecessor = git('cat-file', 'blob', DEED_PRIMARY_CATALOG_PREDECESSOR.blob);
  assert.equal(sha(predecessor), DEED_PRIMARY_CATALOG_PREDECESSOR.sha256); assert.equal(blob(predecessor), DEED_PRIMARY_CATALOG_PREDECESSOR.blob);
  assert.equal(predecessor.split(streetAnchor).length, 2); assert.equal(predecessor.split(burnAnchor).length, 2);
  assert.equal(current, predecessor.replace(streetAnchor, streetAnchor + c3Ddl).replace(burnAnchor, burnAnchor + burnDdl), 'Only the exact two reviewed C3 source hunks');
  assert.equal((current.match(/^CREATE TABLE IF NOT EXISTS /gm) || []).length, 587);
  return freeze({ current, predecessor, actualTables: 587, baselineTables: 586, sourceOnly: true, nativeAdmission: false, priorResultsTransferred: false });
}

export const DEED_PRIMARY_PROVENANCE = freeze([
  ['street_deeds', 'issuance_kind', 'text'], ['street_deeds', 'primary_issuance_receipt', 'jsonb'],
  ['street_deeds', 'last_burn_receipt', 'jsonb'], ['street_deeds', 'last_extraction_receipt', 'jsonb'],
  ['deed_reimports', 'burn_receipt', 'jsonb'],
]);
const oldStreet = 'account_id name name_lc district claimed_at building_id controller_account control_until corner_at shakedown_at home_authority_token sale_price onchain_token_id onchain_owner extracted_by_account extracted_at attested_at ownership_since_day'.split(' ');
const provenanceStreet = DEED_PRIMARY_PROVENANCE.filter(([table]) => table === 'street_deeds').map(([, name]) => name);
// Both immutable native-upgrade fixtures predate building/home/ownership additions.
const legacyStreet = oldStreet.filter(name => !['building_id', 'home_authority_token', 'ownership_since_day'].includes(name));
export const DEED_PRIMARY_STREET_PROFILES = freeze({ fresh: [...oldStreet.slice(0, 6), ...provenanceStreet, ...oldStreet.slice(6)], upgrade586: [...oldStreet, ...provenanceStreet], phase2: [...legacyStreet, 'building_id', ...provenanceStreet, 'home_authority_token', 'ownership_since_day'], director: [...legacyStreet, 'building_id', ...provenanceStreet, 'home_authority_token', 'ownership_since_day'] });
const reimports = 'ref wallet_address token_id status applied_account created_at applied_at burn_receipt'.split(' ');
const specs = freeze([['account_id', 'text', null], ['name', 'text', null], ['name_lc', 'text', null], ['district', 'text', null], ['building_id', 'text', null], ['created_at', 'timestamp with time zone', 'now()']]);
const column = (table_name, column_name, ordinal, type, not_null, default_expression) => ({ table_name, column_name, ordinal, type, typmod: -1, default_expression, not_null, identity: '', generated: '', collation_schema: type === 'text' ? 'pg_catalog' : null, collation_name: type === 'text' ? 'default' : null });
const constraint = (table_name, name, type, definition, columns, flags) => ({ table_name, name, type, validated: true, deferrable: false, deferred: false, definition, match_type: ' ', update_action: ' ', delete_action: ' ', referenced_schema: null, referenced_table: null, columns, referenced_columns: [], ...(flags ? { no_inherit: ['p', 'u', 'f'].includes(type), is_local: true, inheritance_count: 0 } : {}) });
const order = (left, right) => left.table_name < right.table_name ? -1 : left.table_name > right.table_name ? 1 : left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
function expected(version, profile, flags) {
  assert(version === 16 || version === 18); assert(Object.hasOwn(DEED_PRIMARY_STREET_PROFILES, profile)); assert.equal(typeof flags, 'boolean');
  const columns = [...DEED_PRIMARY_PROVENANCE.map(([table, name, type]) => column(table, name, (table === 'street_deeds' ? DEED_PRIMARY_STREET_PROFILES[profile] : reimports).indexOf(name) + 1, type, false, null)), ...specs.map(([name, type, value], i) => column('street_deed_paid_intents', name, i + 1, type, true, value))].sort((a, b) => a.table_name < b.table_name ? -1 : a.table_name > b.table_name ? 1 : a.ordinal - b.ordinal);
  const constraints = [constraint('street_deeds', 'street_deeds_issuance_kind_check', 'c', "CHECK (issuance_kind = ANY (ARRAY['gameplay'::text, 'paid'::text, 'partnership'::text]))", ['issuance_kind'], flags), ...[['account_id', 'pkey', 'p', 'PRIMARY KEY'], ['name_lc', 'name_lc_key', 'u', 'UNIQUE'], ['building_id', 'building_id_key', 'u', 'UNIQUE']].map(([name, suffix, kind, keyword]) => constraint('street_deed_paid_intents', `street_deed_paid_intents_${suffix}`, kind, `${keyword} (${name})`, [name], flags))];
  if (version === 18) for (const row of columns) if (row.not_null) constraints.push(constraint(row.table_name, `${row.table_name}_${row.column_name}_not_null`, 'n', `NOT NULL ${row.column_name}`, [row.column_name], flags));
  const indexes = [['pkey', 'account_id', true], ['name_lc_key', 'name_lc', false], ['building_id_key', 'building_id', false]].map(([suffix, key, primary]) => ({ table_name: 'street_deed_paid_intents', name: `street_deed_paid_intents_${suffix}`, definition: `CREATE UNIQUE INDEX street_deed_paid_intents_${suffix} ON $self.street_deed_paid_intents USING btree (${key})`, unique: true, primary, valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null })).sort(order);
  return { relations: [{ name: 'street_deed_paid_intents', kind: 'r', persistence: 'p' }], columns, constraints: constraints.sort(order), indexes };
}
const isProvenance = row => DEED_PRIMARY_PROVENANCE.some(([table, name]) => row.table_name === table && (row.column_name === name || row.columns?.includes(name) || row.name === `${table}_${name}_not_null`))
  || row.table_name === 'street_deeds' && row.name === 'street_deeds_issuance_kind_check';
const isC3 = (field, row) => field === 'relations' ? row.name === 'street_deed_paid_intents' : row.table_name === 'street_deed_paid_intents' || isProvenance(row);
export function verifyDeedPrimaryCatalogDelta(metadata, version, profile, flags) {
  assert.equal(arguments.length, 4); shape(metadata, [...fields, 'sequences']); const wanted = expected(version, profile, flags);
  for (const field of fields) { assert(Array.isArray(metadata[field])); assert.deepEqual(metadata[field].filter(row => isC3(field, row)), wanted[field], `Every complete current587 C3 ${field} before comparison`); }
  for (const [table, names] of [['street_deeds', DEED_PRIMARY_STREET_PROFILES[profile]], ['deed_reimports', reimports]]) assert.deepEqual(metadata.columns.filter(row => row.table_name === table).map(({ column_name, ordinal }) => ({ column_name, ordinal })), names.map((column_name, i) => ({ column_name, ordinal: i + 1 })), 'Exact literal C3 physical column order; no generic ordinal normalization');
  return true;
}
export function deedPrimaryComparisonMetadata(metadata, version, profile, flags) {
  verifyDeedPrimaryCatalogDelta(metadata, version, profile, flags);
  const names = DEED_PRIMARY_STREET_PROFILES[profile];
  return { ...Object.fromEntries(fields.map(field => [field, metadata[field].filter(row => !isC3(field, row)).map(row => field === 'columns' && row.table_name === 'street_deeds' ? { ...row, ordinal: row.ordinal - names.slice(0, row.ordinal - 1).filter(name => provenanceStreet.includes(name)).length } : row)])), sequences: metadata.sequences };
}
export function deedPrimaryComparisonConstraints(rows, version, includeNotNull, profile) {
  assert.equal(arguments.length, 4); assert(Array.isArray(rows)); assert.equal(typeof includeNotNull, 'boolean');
  assert.deepEqual(rows.filter(row => isC3('constraints', row)), expected(version, profile, false).constraints.filter(row => includeNotNull || row.type !== 'n').map(({ table_name, name, definition }) => ({ table_name, name, definition })), 'Exact C3 constraint view before historical comparison');
  return rows.filter(row => !isC3('constraints', row));
}
export function deedPrimaryCatalogProjection(reference, baseline, version, profile, flags) {
  assert.equal(arguments.length, 5); shape(baseline, [...fields, 'sequences']);
  assert.deepEqual(deedPrimaryComparisonMetadata(reference, version, profile, flags), baseline, 'Every retained586 field equals a separately compiled historical reference');
  freeze(reference); freeze(baseline);
  return Object.freeze({ reference, baseline, verify: value => { assert.deepEqual(deedPrimaryComparisonMetadata(value, version, profile, flags), baseline); assert.deepEqual(value, reference, 'Complete independently qualified current587 catalog'); return true; }, projectMetadata: value => { const result = deedPrimaryComparisonMetadata(value, version, profile, flags); assert.deepEqual(result, baseline); return result; }, sourceOnly: true, nativeAdmission: false, priorResultsTransferred: false });
}
export const DEED_PRIMARY_DDL_CONTROLS = freeze([
  ...DEED_PRIMARY_PROVENANCE.flatMap(([table, name]) => [`ALTER TABLE ${table} DROP COLUMN ${name} CASCADE`, `ALTER TABLE ${table} ALTER COLUMN ${name} SET NOT NULL`]),
  'ALTER TABLE street_deeds ALTER COLUMN primary_issuance_receipt TYPE text USING primary_issuance_receipt::text',
  "ALTER TABLE street_deeds ALTER COLUMN issuance_kind SET DEFAULT 'paid'",
  'ALTER TABLE deed_reimports ALTER COLUMN burn_receipt SET DEFAULT \'{}\'::jsonb',
  ...specs.flatMap(([name]) => [`ALTER TABLE street_deed_paid_intents DROP COLUMN ${name} CASCADE`, ...(name !== 'account_id' ? [`ALTER TABLE street_deed_paid_intents ALTER COLUMN ${name} DROP NOT NULL`] : [])]),
  'ALTER TABLE street_deed_paid_intents ALTER COLUMN created_at DROP DEFAULT',
  'ALTER TABLE street_deed_paid_intents ALTER COLUMN name TYPE varchar',
  'ALTER TABLE street_deed_paid_intents ADD COLUMN unknown TEXT',
  ...['pkey', 'name_lc_key', 'building_id_key'].map(name => `ALTER TABLE street_deed_paid_intents DROP CONSTRAINT street_deed_paid_intents_${name}`),
  'ALTER TABLE street_deeds DROP CONSTRAINT street_deeds_issuance_kind_check',
  'CREATE TABLE unknown_c3_table (id TEXT)',
]);

// Native entrypoints below are separately admitted; pure source/catalog validation grants no I/O authority.
const contexts = new WeakMap();
export function requireDeedPrimaryComparisonContext(value) {
  const context = contexts.get(value); assert(context, 'Only this invocation\'s genuine current587 comparison context'); return context;
}
let sourceCapture;
const stableSource = () => { if (!sourceCapture) sourceCapture = captureQuestingEnterpriseSource(); assertQuestingEnterpriseStable(sourceCapture); return sourceCapture; };
function actualSource(input) {
  stableSource(); const physical = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8');
  const actual = deedPrimaryCatalogSource(input);
  assert.equal(actual.current, physical.replaceAll('\r\n', '\n'), 'Native current587 is the complete actual physical schema');
  deedPrimaryCatalogSource(physical); return actual;
}
function canonicalCaller() {
  assert.equal(process.execArgv.length, 0); assert.equal(process.argv.length, 3);
  const caller = path.resolve(process.argv[1]);
  if (caller === path.join(root, 'test', 'enterprise-release-phase2-migration-catalog.js')) { assert.equal(process.argv[2], '--postgres'); return 'enterprise'; }
  if (caller === path.join(root, 'test', 'phase2-postgres.js')) { assert(['--definitions', '--lots'].includes(process.argv[2])); return 'phase2'; }
  assert.equal(caller, path.join(root, 'test', 'director-migration.js'), 'Only canonical current587 native callers'); assert.equal(process.argv[2], '--postgres'); return 'director';
}
export function assertDeedPrimaryPhase2SourceInputs() {
  assert.equal(arguments.length, 0); assert(['phase2', 'director'].includes(canonicalCaller()));
  return actualSource(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8')).current;
}
async function nativeBackend(pool, endpoint, caller, profile) {
  const address = new URL(endpoint), local = ['35439', '35449'].includes(address.port) && address.username === 'pilot_runner' && !address.password;
  assert(['postgres:', 'postgresql:'].includes(address.protocol) && address.hostname === '127.0.0.1' && !address.search && !address.hash);
  assert(local || address.port === '5432' && address.username === 'postgres' && address.password === 'pgcheck');
  if (caller === 'enterprise') {
    assert.equal(profile, 'fresh'); assert.match(address.pathname, /^\/enterprise_native_catalog_test_[a-f0-9]{12}$/);
    assert(new URL(process.env.ENTERPRISE_NATIVE_CATALOG_TEST_DATABASE_URL).href === address.href, 'Selected dedicated Enterprise endpoint matches');
    for (const key of Object.keys(process.env)) { if (/DATABASE_URL$/i.test(key)) assert.equal(key, 'ENTERPRISE_NATIVE_CATALOG_TEST_DATABASE_URL'); else assert(!/^PG|^RC1|^P2_TEST/i.test(key) && !['NODE_OPTIONS', 'NODE_PATH', 'NODE_PG_FORCE_NATIVE', 'LEGAL_PROFILE_DEFER', 'GENESIS_AUCTION_MANIFEST_PATH', 'GENESIS_AUCTION_MANIFEST_SHA256'].includes(key.toUpperCase())); }
    assert.equal(process.env.CHAIN_ENABLED, 'off'); assert.equal(process.env.RESOURCE_ECONOMY, 'off');
  } else {
    assert(['/omerta_check', '/omerta_query'].includes(address.pathname));
    assert(!process.env.NODE_OPTIONS && !process.env.NODE_PATH && !process.env.NODE_PG_FORCE_NATIVE && !process.env.LEGAL_PROFILE_DEFER);
    if (caller === 'director') { assert.equal(profile, 'director'); assert(new URL(process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL).href === address.href, 'Selected dedicated Director endpoint matches'); }
    else { assert.equal(profile, process.argv[2] === '--definitions' ? 'phase2' : 'fresh'); assert.equal(process.env.P2_TEST_CHILD, profile === 'phase2' ? 'upgrade' : 'lots-catalog'); }
  }
  const row = (await pool.query("SELECT current_user AS role,current_database() AS database,current_schema() AS schema,current_setting('server_version') AS version,current_setting('data_directory') AS directory,(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner")).rows[0];
  assert.equal(row.role, address.username); assert.equal(row.owner, row.role); assert.equal('/' + row.database, address.pathname); assert.match(row.version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
  if (local) assert.equal(row.directory.replaceAll('\\', '/').toLowerCase(), { '35439': 'c:/users/jorge/appdata/local/temp/omerta-economy-oct15-pg184', '35449': 'c:/users/jorge/appdata/local/temp/omerta-employment-pg184-proof' }[address.port]);
  if (caller === 'enterprise') assert.equal(row.schema, 'public');
  else if (caller === 'director') assert.match(row.schema, /^director_migration_[a-f0-9]{16}$/);
  else { assert.match(row.schema, /^p2_definitions_[a-f0-9]{32}$/); assert.equal(row.schema, process.env.P2_TEST_SCHEMA); }
  return { address, version: Number(row.version.split('.')[0]) };
}
async function empty(pool) {
  assert.deepEqual((await pool.query("SELECT nspname FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema' ORDER BY nspname")).rows.map(row => row.nspname), ['public']);
  assert.deepEqual((await pool.query("SELECT c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,c.relkind")).rows, []);
}
export async function readDeedPrimaryNativeMetadata(client) {
  const { readTaskPuzzleNativeMetadata } = await import('./task-puzzle-native-catalog.js'); return readTaskPuzzleNativeMetadata(client);
}
async function ownedCompile(pool, address, sources, inspect) {
  const { default: pg } = await import('pg');
  const name = 'release_phase2_ref_' + crypto.randomBytes(8).toString('hex'); let created = false, client, failure;
  try {
    assert.deepEqual((await pool.query('SELECT nspname FROM pg_namespace WHERE nspname=$1', [name])).rows, []);
    await pool.query(`CREATE SCHEMA ${name}`); created = true;
    const url = new URL(address); url.searchParams.set('options', `-c search_path=${name} -c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000`);
    client = new pg.Client({ connectionString: url.href }); await client.connect();
    assert.deepEqual((await client.query("SELECT current_schema() AS schema,current_database() AS database,current_user AS role,current_setting('statement_timeout') AS timeout,current_setting('lock_timeout') AS lock_timeout,current_setting('idle_in_transaction_session_timeout') AS idle_timeout")).rows[0], { schema: name, database: address.pathname.slice(1), role: address.username, timeout: '30s', lock_timeout: '5s', idle_timeout: '30s' });
    for (const source of sources) await client.query(source);
    const metadata = await readDeedPrimaryNativeMetadata(client);
    assert.deepEqual(metadata.relations.filter(row => ['r', 'p'].includes(row.kind)).map(row => row.name).sort(), [...sources.at(-1).matchAll(/^CREATE TABLE IF NOT EXISTS (\w+)/gm)].map(row => row[1]).sort(), 'Complete actually executed raw source table inventory');
    if (inspect) await inspect(client, metadata); return metadata;
  } catch (error) { failure = error; throw error; }
  finally {
    const failures = [];
    try { await client?.end(); } catch (error) { failures.push(error); }
    try { if (created) { assert.equal((await pool.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1', [name])).rows[0]?.mine, true); await pool.query(`DROP SCHEMA ${name} CASCADE`); assert.deepEqual((await pool.query('SELECT nspname FROM pg_namespace WHERE nspname=$1', [name])).rows, []); } } catch (error) { failures.push(error); }
    if (failures.length) { if (!failure) throw new AggregateError(failures, 'Owned current587 catalog cleanup failed'); failure.cleanupFailures = failures.map(error => error.code || 'cleanup_failed'); }
  }
}
async function ddlControls(client, verify, ddls) {
  let causal = 0;
  for (const ddl of ddls) {
    await client.query('BEGIN');
    try { await client.query(ddl); await assert.rejects(async () => verify(await readDeedPrimaryNativeMetadata(client)), error => error?.code === 'ERR_ASSERTION'); causal++; }
    finally { await client.query('ROLLBACK'); }
    verify(await readDeedPrimaryNativeMetadata(client));
  }
  return causal;
}
function upgradePrefix(profile) {
  if (profile === 'phase2') {
    const text = git('show', '8dbe85846035dc0fcdba76992834e411632c6f1b:schema.sql');
    assert.equal(sha(text), '2313bee0087bc90c5987ab6482d1cdc176a3060da8e24f487453a518d79a27c0');
    const boundary = '-- Phase 2 sealed definition plane;', offset = text.indexOf(boundary); assert(offset > 0 && offset === text.lastIndexOf(boundary)); return text.slice(0, offset);
  }
  assert.equal(profile, 'director'); const text = git('show', '44f48a743e549591bd125a1f678099b8382dd78f:schema.sql');
  assert.equal(sha(text), '6be8c8b0f8cd99559713bb0552302fc399f1b3d88a98705f74c571090c18ca18'); return text;
}
const questDdl = ['ALTER TABLE quest_workshop_mysteries ADD COLUMN unreviewed TEXT', 'ALTER TABLE quest_workshop_plays ADD COLUMN unreviewed TEXT', 'ALTER TABLE quest_reading_room ADD COLUMN unreviewed TEXT', 'ALTER TABLE quest_workshop_mysteries DROP CONSTRAINT quest_workshop_mysteries_author_account_id_fkey', 'ALTER TABLE quest_workshop_plays DROP CONSTRAINT quest_workshop_plays_mystery_id_fkey', 'ALTER TABLE quest_workshop_plays DROP CONSTRAINT quest_workshop_plays_account_id_fkey', 'ALTER TABLE quest_reading_room DROP CONSTRAINT quest_reading_room_account_id_fkey', 'ALTER TABLE quest_workshop_mysteries DROP CONSTRAINT quest_workshop_mysteries_status_check', 'ALTER TABLE quest_workshop_plays DROP CONSTRAINT quest_workshop_plays_stars_check', 'ALTER TABLE quest_workshop_mysteries ALTER COLUMN author_credit DROP NOT NULL', 'ALTER TABLE quest_workshop_plays ALTER COLUMN attempts SET DEFAULT 42', 'DROP INDEX ix_quest_workshop_author', 'DROP INDEX ix_quest_workshop_published'];
async function compileReferences(pool, address, source, version, full, profile) {
  const task = await import('./task-puzzle-native-catalog.js'), quest = await import('./questing-enterprise-catalog.js');
  const historical = task.taskPuzzleCatalogSource(source.predecessor);
  const baseline = await ownedCompile(pool, address, [source.predecessor]);
  const questBaseline = await ownedCompile(pool, address, [historical.predecessor]);
  const casinoBaseline = await ownedCompile(pool, address, [historical.quest.baseline]);
  const archivedCasino = await ownedCompile(pool, address, [historical.quest.archivedBaseline]);
  const withoutSequence = metadata => { assert.deepEqual(metadata.sequences, { definition: [], ownership: [], bindings: [] }); const { sequences, ...result } = metadata; return result; };
  const questProof = quest.questingCatalogProjection(withoutSequence(questBaseline), withoutSequence(casinoBaseline), version);
  questProof.verify(withoutSequence(questBaseline));
  assert.deepEqual(quest.questingCasinoCatalogProjection(withoutSequence(casinoBaseline), version, 'fresh', true), withoutSequence(archivedCasino));
  task.taskPuzzleCatalogProjection(baseline, withoutSequence(questBaseline), version, 'fresh', true).verify(baseline);
  let historicalIdempotent = 0;
  const historicalInspect = historicalProfile => async (client, metadata) => {
    const proof = task.taskPuzzleCatalogProjection(metadata, withoutSequence(questBaseline), version, historicalProfile, true);
    await client.query(source.predecessor); proof.verify(await readDeedPrimaryNativeMetadata(client)); historicalIdempotent++;
  };
  await ownedCompile(pool, address, [source.predecessor], historicalInspect('fresh'));
  await ownedCompile(pool, address, [historical.predecessor, source.predecessor], historicalInspect('upgrade585'));
  let c3DdlCausal = 0, puzzleDdlCausal = 0, questDdlCausal = 0, casinoDdlCausal = 0, idempotent = 0;
  const inspect = currentProfile => async (client, metadata) => {
    const proof = deedPrimaryCatalogProjection(metadata, baseline, version, currentProfile, true);
    if (full) {
      c3DdlCausal += await ddlControls(client, proof.verify, DEED_PRIMARY_DDL_CONTROLS);
      puzzleDdlCausal += await ddlControls(client, proof.verify, task.TASK_PUZZLE_DDL_CONTROLS);
      questDdlCausal += await ddlControls(client, proof.verify, questDdl);
      casinoDdlCausal += await ddlControls(client, proof.verify, quest.QUESTING_CASINO_DDL_CONTROLS);
    }
    await client.query(source.current); proof.verify(await readDeedPrimaryNativeMetadata(client)); idempotent++;
  };
  const current = await ownedCompile(pool, address, [source.current], inspect('fresh'));
  const upgraded = await ownedCompile(pool, address, [source.predecessor, source.current], inspect('upgrade586'));
  const live = profile === 'fresh' ? { reference: current, baseline, profile } : await (async () => {
    const prefix = upgradePrefix(profile), old = await ownedCompile(pool, address, [prefix, source.predecessor]);
    const reference = await ownedCompile(pool, address, [prefix, source.current]);
    deedPrimaryCatalogProjection(reference, old, version, profile, true).verify(reference); return { reference, baseline: old, profile };
  })();
  stableSource();
  return freeze({ current, upgraded, baseline, live, actualTables: 587, baselineTables: 586, idempotent, c3DdlCausal, puzzleDdlCausal, questDdlCausal, casinoDdlCausal, priorResultsTransferred: false,
    taskReferences: { scope: 'independent-positive-current586-references', actualTables: 586, baselineTables: 585, idempotent: historicalIdempotent, comparisonOnly: true, referenceDdl: { status: 'not-run', owner: 'test/enterprise-release-phase2-migration-catalog.js --postgres' } } });
}
export async function verifyDeedPrimaryEnterpriseCatalog(pool, endpoint, raw) {
  assert.equal(arguments.length, 3); assert.equal(canonicalCaller(), 'enterprise'); const source = actualSource(raw);
  const { address, version } = await nativeBackend(pool, endpoint, 'enterprise', 'fresh'); await empty(pool);
  const references = await compileReferences(pool, address, source, version, true, 'fresh'); await empty(pool); stableSource();
  const historicalSource = git('show', '52c582d7859843e02f45ed5d5c2377c996dd43da:schema.sql');
  assert.equal(sha(historicalSource), '833373245ddb1ce5a3c9ed386a9b3245d81ddb0bdb51e75d1e5ffee2a7684335');
  const compiler = await import('./commerce-deed-release-phase2-native-catalog.js');
  const historical = await compiler.verifyCommerceEnterpriseSlotBranches(pool, endpoint, historicalSource);
  await empty(pool); stableSource();
  return freeze({ ...references, historical, phase: 'ACTUAL_DEED_PRIMARY587_ENTERPRISE_CATALOG', native: true, priorNativeResultsTransferred: false });
}
const rawConstraints = rows => rows.map(({ no_inherit, is_local, inheritance_count, ...row }) => row);
async function projectedCaller(pool, proof, facade) {
  const queries = facade.deedPrimaryHistoricalMetadataQueries(), queryFields = new Map(queries.slice(1).map((sql, i) => [sql, ['relations', 'constraints', 'columns', 'indexes'][i]]));
  const context = (await pool.query(queries[0])).rows[0];
  const wrap = queryable => ({ query: async (sql, values) => {
    if (!queryFields.has(sql) && sql !== queries[0]) return queryable.query(sql, values);
    stableSource();
    const actual = await readDeedPrimaryNativeMetadata(queryable); proof.verify(actual);
    const field = queryFields.get(sql); if (!field) return queryable.query(sql, values);
    let rows = proof.projectMetadata(actual)[field];
    if (field === 'constraints') rows = rawConstraints(rows);
    if (field === 'indexes') rows = rows.map(row => ({ ...row, definition: row.definition.replace(' ON $self.', ' ON ' + context.schema + '.') }));
    return { rows, rowCount: rows.length, command: 'SELECT' };
  } });
  return { ...wrap(pool), connect: async () => { const client = await pool.connect(); try { return { ...wrap(client), release: client.release.bind(client) }; } catch (error) { client.release(); throw error; } } };
}
const liveStates = new WeakMap(), livePools = new WeakMap();
async function liveContext(pool, endpoint, input, profile) {
  const caller = canonicalCaller(); assert(['phase2', 'director'].includes(caller));
  const source = actualSource(input), { address, version } = await nativeBackend(pool, endpoint, caller, profile);
  const references = await compileReferences(pool, address, source, version, false, profile);
  const proof = deedPrimaryCatalogProjection(references.live.reference, references.live.baseline, version, profile, true);
  proof.verify(await readDeedPrimaryNativeMetadata(pool));
  const { taskPuzzleCatalogSource } = await import('./task-puzzle-native-catalog.js');
  const facade = await import('./questing-ux-release-phase2-native-catalog.js');
  const token = Object.freeze({});
  contexts.set(token, Object.freeze({ pool: await projectedCaller(pool, proof, facade), endpoint, actual: taskPuzzleCatalogSource(source.predecessor), version, profile, references: references.taskReferences, assertStable: stableSource }));
  const state = { token, pool, proof, references, version, profile, facade }; livePools.set(pool, state); return state;
}
function extendLive(prior, state) {
  const normalize = rows => prior.normalize(deedPrimaryComparisonConstraints(rows, state.version, prior.includeNotNull, state.profile));
  const verifyMetadata = metadata => {
    const old = state.proof.projectMetadata(metadata), questNames = new Set(['quest_workshop_mysteries', 'quest_workshop_plays', 'quest_reading_room']);
    // The retained live engine enriches flags only on its quest rows; the full
    // independent587 reader above has already checked flags for every constraint.
    prior.verifyMetadata({ ...old, constraints: old.constraints.map(row => questNames.has(row.table_name) ? row : rawConstraints([row])[0]) }); return true;
  };
  const result = Object.freeze({ ...prior, reference: state.proof.reference, ...(prior.current ? { current: state.proof.reference } : {}), verifyMetadata,
    ...(prior.verify ? { verify: verifyMetadata } : {}), ...(prior.normalize ? { normalize } : {}),
    actualTables: 587, deedPrimaryReferences: state.references, priorNativeResultsTransferred: false,
    phase: 'Actual587 current C3 catalog; independently executed historical586 comparison only; ' + prior.phase });
  liveStates.set(result, { ...state, prior }); return result;
}
export async function createDeedPrimaryReleasePhase2MigrationCatalog(pool, endpoint, input, options) {
  assert.equal(arguments.length, 4); assert(options?.legacyProfile === 'phase2' || options?.legacyProfile === 'director');
  assert.equal(options.includeNotNull, options.legacyProfile === 'phase2');
  const state = await liveContext(pool, endpoint, input, options.legacyProfile);
  const prior = await state.facade.createDeedPrimaryHistoricalComparison(state.token, options); stableSource(); return extendLive(prior, state);
}
export async function verifyDeedPrimaryNativeBranches(pool, endpoint) {
  assert.equal(arguments.length, 2);
  const state = await liveContext(pool, endpoint, fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'), 'fresh');
  const prior = await state.facade.verifyDeedPrimaryHistoricalBranches(state.token); stableSource(); return extendLive(prior, state);
}
export async function readDeedPrimaryReleasePhase2Metadata(pool) {
  assert.equal(arguments.length, 1); canonicalCaller(); actualSource(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'));
  const state = livePools.get(pool); assert(state, 'Only an independently admitted current587 pool');
  const metadata = await readDeedPrimaryNativeMetadata(pool); state.proof.verify(metadata); stableSource(); return metadata;
}
export async function verifyDeedPrimaryReleasePhase2CausalNegatives(pool, catalog, rows, verifyRows) {
  assert.equal(arguments.length, 4); const state = liveStates.get(catalog); assert(state && state.pool === pool, 'Only this current587 native invocation and pool'); stableSource();
  const actual = await readDeedPrimaryNativeMetadata(pool); state.proof.verify(actual);
  const parentRows = deedPrimaryComparisonConstraints(rows, state.version, state.prior.includeNotNull, state.profile), added = rows.filter(row => !parentRows.includes(row));
  const sorted = values => [...values].sort(order);
  const result = await state.facade.verifyDeedPrimaryHistoricalCausalNegatives(state.token, state.prior, parentRows, candidate => verifyRows(sorted([...candidate, ...added])));
  state.proof.verify(await readDeedPrimaryNativeMetadata(pool)); stableSource(); return result;
}
