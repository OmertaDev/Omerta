// Actual quest schema compilation; historical catalogs remain independently qualified references.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const gitBlob = bytes => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest('hex');
const git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], { cwd: root, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const fields = ['relations', 'columns', 'constraints', 'indexes'];
const uniform = input => {
  assert.equal(typeof input, 'string'); const value = input.replaceAll('\r\n', '\n');
  assert(!value.includes('\r') && (input === value || input === value.replaceAll('\n', '\r\n')), 'Whole LF or uniform checkout CRLF only');
  return value;
};
export const QUESTING_CATALOG_SOURCE = freeze({ file: 'schema.sql', mode: '100755', blob: '86b671c5d6f6928ff3e66f1ad0fca5f46a7364e3',
  sha256: '659235a1735d24dbebc5f9b4dfcff8a58ed766a27fd3ae32fc6c6d2ec77006dc' });
export const QUESTING_CATALOG_ARCHIVED_SOURCE = freeze({ blob: '7a254a435c95a93cc5d8419b453988b0df30b5c1',
  sha256: 'af6d9ad01566eaddf8ec6b4c4da4add77837b13e6a3510697bebf62b180b97e7' });
export const QUESTING_CATALOG_BASELINE = freeze({ revision: '17fdf85fdd21fd3767463df8ba47614f7d1f6432', file: 'schema.sql',
  blob: '9795c322aed438cb3011bf16b83bc399af6200d5', sha256: '9f272bef0d8a6ebb22d94654a7e3daa2f2e2c0f2fe94a3b429973c3923cca976' });
export const QUESTING_CATALOG_TABLES = Object.freeze(['quest_workshop_mysteries', 'quest_workshop_plays', 'quest_reading_room']);
const tables = new Set(QUESTING_CATALOG_TABLES);
export const QUESTING_CATALOG_COLUMNS = freeze({
  quest_workshop_mysteries: [
    ['id', 'text', true, null], ['author_account_id', 'text', true, null], ['author_credit', 'text', true, null],
    ['title', 'text', true, null], ['template_id', 'text', true, null], ['scene_id', 'text', true, null],
    ['culprit_id', 'text', true, null], ['clue_ids', 'text', true, null], ['status', 'text', true, "'draft'::text"],
    ['created_at', 'timestamp with time zone', true, 'now()'], ['published_at', 'timestamp with time zone', false, null],
  ],
  quest_workshop_plays: [['mystery_id', 'text', true, null], ['account_id', 'text', true, null],
    ['attempts', 'integer', true, '0'], ['solved_at', 'timestamp with time zone', false, null], ['stars', 'integer', false, null]],
  quest_reading_room: [['account_id', 'text', true, null], ['day_ordinal', 'integer', true, null], ['exercise_id', 'text', true, null],
    ['attempts', 'integer', true, '0'], ['solved_at', 'timestamp with time zone', false, null]],
});
const primary = { quest_workshop_mysteries: ['id'], quest_workshop_plays: ['mystery_id', 'account_id'], quest_reading_room: ['account_id', 'day_ordinal'] };
const foreign = {
  quest_workshop_mysteries_author_account_id_fkey: ['quest_workshop_mysteries', 'author_account_id', 'accounts'],
  quest_workshop_plays_mystery_id_fkey: ['quest_workshop_plays', 'mystery_id', 'quest_workshop_mysteries'],
  quest_workshop_plays_account_id_fkey: ['quest_workshop_plays', 'account_id', 'accounts'],
  quest_reading_room_account_id_fkey: ['quest_reading_room', 'account_id', 'accounts'],
};
const checks = new Set(['quest_workshop_mysteries_status_check', 'quest_workshop_plays_stars_check']);
const indexColumns = {
  quest_workshop_mysteries_pkey: ['quest_workshop_mysteries', ['id'], true],
  quest_workshop_plays_pkey: ['quest_workshop_plays', ['mystery_id', 'account_id'], true],
  quest_reading_room_pkey: ['quest_reading_room', ['account_id', 'day_ordinal'], true],
  ix_quest_workshop_author: ['quest_workshop_mysteries', ['author_account_id'], false],
  ix_quest_workshop_published: ['quest_workshop_mysteries', ['status', 'published_at'], false],
};
export function questingCatalogSource(input) {
  const current = uniform(input); assert.equal(sha(current), QUESTING_CATALOG_SOURCE.sha256, 'Exact complete actual quest585 schema');
  assert.equal(gitBlob(current), QUESTING_CATALOG_SOURCE.blob); assert.equal((current.match(/^CREATE TABLE IF NOT EXISTS /gm) || []).length, 585);
  const baseline = git('show', `${QUESTING_CATALOG_BASELINE.revision}:schema.sql`).toString('utf8');
  assert.equal(sha(baseline), QUESTING_CATALOG_BASELINE.sha256); assert.equal(gitBlob(baseline), QUESTING_CATALOG_BASELINE.blob);
  const archived = git('cat-file', 'blob', QUESTING_CATALOG_ARCHIVED_SOURCE.blob).toString('utf8');
  assert.equal(sha(archived), QUESTING_CATALOG_ARCHIVED_SOURCE.sha256); assert.equal(gitBlob(archived), QUESTING_CATALOG_ARCHIVED_SOURCE.blob);
  assert(archived.startsWith(baseline), 'Archived585 retains the complete independently pinned582 prefix');
  const addition = archived.slice(baseline.length);
  assert.deepEqual([...addition.matchAll(/^CREATE TABLE IF NOT EXISTS (\w+) /gm)].map(row => row[1]), QUESTING_CATALOG_TABLES);
  assert(!/\b(?:ALTER|DROP|UPDATE|DELETE|INSERT)\b/i.test(addition), 'Exactly three additive tables and their indexes');
  // Only the two reviewed literal edits introduce the four casino accounting fields. The quest
  // suffix and archived source stay exact; CREATE IF NOT EXISTS is not an old-casino migration.
  const cursor = '  rake_cursor NUMERIC NOT NULL DEFAULT 0,           -- Den step 2: den volume already rakeback-claimed (casino kind only)\n';
  const volume = '  distributed NUMERIC NOT NULL DEFAULT 0\n';
  let currentBaseline = baseline;
  for (const [before, after] of [[cursor, cursor + '  rake_index_cursor TEXT,                          -- exact rational claimed rakeback index; NULL identifies legacy volume cursors\n'],
    [volume, '  distributed NUMERIC NOT NULL DEFAULT 0,\n  rake_index TEXT NOT NULL DEFAULT \'0\',            -- exact per-owner cash entitlement, serialized numerator/denominator\n  rake_checkpoint_volume NUMERIC,                  -- NULL until legacy claims are snapshotted before an ownership change\n  rake_legacy_owners INT NOT NULL DEFAULT 0\n']]) {
    assert.equal(currentBaseline.split(before).length, 2, 'Unique complete reviewed casino DDL context');
    currentBaseline = currentBaseline.replace(before, after);
  }
  assert.equal(sha(currentBaseline), '9d664391bd9b6a774f2ce934dd5821bcc7f323cc84e5a9c4dd02d357500829f5');
  assert.equal(gitBlob(currentBaseline), 'ae53d28222559260e80ea68abafe7c429f214ff9');
  assert.equal(current, currentBaseline + addition, 'Only four reviewed fields differ; all three quest tables remain exact');
  return freeze({ current, baseline: currentBaseline, archivedBaseline: baseline, archived, addition, actualTables: 585, baselineTables: 582 });
}
function validateAdded(metadata, version) {
  assert(version === 16 || version === 18); const added = field => metadata[field].filter(row => tables.has(field === 'relations' ? row.name : row.table_name));
  assert.deepEqual(added('relations').map(row => row.name).sort(), [...tables].sort());
  for (const row of added('relations')) assert.deepEqual(row, { name: row.name, kind: 'r', persistence: 'p' });
  assert.equal(added('columns').length, 21);
  for (const [table, columns] of Object.entries(QUESTING_CATALOG_COLUMNS)) {
    const rows = added('columns').filter(row => row.table_name === table); assert.equal(rows.length, columns.length);
    for (const [i, [name, type, notNull, defaultExpression]] of columns.entries()) {
      assert.deepEqual(rows[i], { table_name: table, column_name: name, ordinal: i + 1, type, typmod: -1, default_expression: defaultExpression,
        not_null: notNull, identity: '', generated: '', collation_schema: type === 'text' ? 'pg_catalog' : null, collation_name: type === 'text' ? 'default' : null });
    }
  }
  const constraint = (table_name, name, type, definition, columns) => ({ table_name, name, type, validated: true,
    deferrable: false, deferred: false, definition, match_type: ' ', update_action: ' ', delete_action: ' ',
    referenced_schema: null, referenced_table: null, columns, referenced_columns: [],
    no_inherit: type === 'p' || type === 'f', is_local: true, inheritance_count: 0 });
  const expectedConstraints = Object.entries(primary).map(([table, cols]) => constraint(table, `${table}_pkey`, 'p', `PRIMARY KEY (${cols.join(', ')})`, cols));
  for (const [name, [table, column, target]] of Object.entries(foreign)) expectedConstraints.push({
    ...constraint(table, name, 'f', `FOREIGN KEY (${column}) REFERENCES ${target}(id)`, [column]),
    match_type: 's', update_action: 'a', delete_action: 'a', referenced_schema: '$self', referenced_table: target, referenced_columns: ['id'],
  });
  expectedConstraints.push(constraint('quest_workshop_mysteries', 'quest_workshop_mysteries_status_check', 'c',
    "CHECK (status = ANY (ARRAY['draft'::text, 'published'::text]))", ['status']),
  constraint('quest_workshop_plays', 'quest_workshop_plays_stars_check', 'c', 'CHECK (stars >= 1 AND stars <= 5)', ['stars']));
  if (version === 18) for (const [table, cols] of Object.entries(QUESTING_CATALOG_COLUMNS)) for (const [name, , required] of cols) if (required) {
    expectedConstraints.push(constraint(table, `${table}_${name}_not_null`, 'n', `NOT NULL ${name}`, [name]));
  }
  const order = (a, b) => a.table_name < b.table_name ? -1 : a.table_name > b.table_name ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  assert.deepEqual([...added('constraints')].sort(order), expectedConstraints.sort(order), 'Independently authored complete constraint definitions, names, flags, actions and references');
  const indexes = added('indexes'); assert.equal(indexes.length, 5);
  assert.deepEqual(indexes.map(row => row.name).sort(), Object.keys(indexColumns).sort());
  for (const row of indexes) {
    const [table, columns, unique] = indexColumns[row.name];
    assert.deepEqual(row, { table_name: table, name: row.name, definition: `CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${row.name} ON $self.${table} USING btree (${columns.join(', ')})`,
      unique, primary: row.name.endsWith('_pkey'), valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null });
  }
}
export { validateAdded as verifyQuestingCatalogTables };
const casinoColumns = new Set(['businesses.rake_index_cursor', 'den_volume.rake_index', 'den_volume.rake_checkpoint_volume', 'den_volume.rake_legacy_owners']);
const casinoNames = new Set(['den_volume_rake_index_not_null', 'den_volume_rake_legacy_owners_not_null']);
function casinoExpected(version, profile, flags) {
  assert(version === 16 || version === 18); assert(['fresh', 'phase2', 'director'].includes(profile)); assert.equal(typeof flags, 'boolean');
  const column = (table, name, ordinal, type, notNull, value) => ({ table_name: table, column_name: name, ordinal, type, typmod: -1,
    default_expression: value, not_null: notNull, identity: '', generated: '', collation_schema: type === 'text' ? 'pg_catalog' : null,
    collation_name: type === 'text' ? 'default' : null });
  const offset = profile === 'fresh' ? 0 : 1;
  const columns = [column('businesses', 'rake_index_cursor', profile === 'fresh' ? 13 : 18, 'text', false, null),
    column('den_volume', 'rake_index', 5 + offset, 'text', true, "'0'::text"),
    column('den_volume', 'rake_checkpoint_volume', 6 + offset, 'numeric', false, null),
    column('den_volume', 'rake_legacy_owners', 7 + offset, 'integer', true, '0')];
  const constraints = version === 18 ? ['rake_index', 'rake_legacy_owners'].map(name => ({ table_name: 'den_volume',
    name: 'den_volume_' + name + '_not_null', type: 'n', validated: true, deferrable: false, deferred: false,
    definition: 'NOT NULL ' + name, match_type: ' ', update_action: ' ', delete_action: ' ', referenced_schema: null,
    referenced_table: null, columns: [name], referenced_columns: [], ...(flags ? { no_inherit: false, is_local: true, inheritance_count: 0 } : {}) })) : [];
  return { columns, constraints };
}
export function questingCasinoCatalogRows(field, rows, version, profile, flags) {
  assert(fields.includes(field)); assert(Array.isArray(rows)); const expected = casinoExpected(version, profile, flags);
  if (field === 'columns') {
    assert.deepEqual(rows.filter(row => casinoColumns.has(row.table_name + '.' + row.column_name)), expected.columns,
      'Every reviewed casino column field and exact profile ordinal qualifies before filtering');
    const business = ['id', 'character_id', 'kind', 'tier', 'last_collect_at', 'launder_used', 'launder_at', 'scrutiny', 'scrutiny_at',
      'shakedown_at', 'inside_at', 'rake_cursor', 'upkeep_at', 'acquired_at', 'spec', 'spec_at', 'takeover_cd_until'];
    const volume = ['id', 'total', 'profit', 'distributed', 'jackpot'];
    if (profile === 'fresh') { business.splice(12, 0, 'rake_index_cursor'); volume.splice(4, 0, 'rake_index', 'rake_checkpoint_volume', 'rake_legacy_owners'); }
    else { business.push('rake_index_cursor'); volume.push('rake_index', 'rake_checkpoint_volume', 'rake_legacy_owners'); }
    for (const [table, names] of [['businesses', business], ['den_volume', volume]]) assert.deepEqual(
      rows.filter(row => row.table_name === table).map(({ column_name, ordinal }) => ({ column_name, ordinal })),
      names.map((column_name, i) => ({ column_name, ordinal: i + 1 })), 'Complete literal fresh or migrated casino column layout');
    return rows.filter(row => !casinoColumns.has(row.table_name + '.' + row.column_name)).map(row => {
      if (profile === 'fresh' && row.table_name === 'businesses' && row.ordinal > 13) return { ...row, ordinal: row.ordinal - 1 };
      if (profile === 'fresh' && row.table_name === 'den_volume' && row.ordinal > 7) return { ...row, ordinal: row.ordinal - 3 };
      return row;
    });
  }
  if (field === 'constraints') {
    const selected = row => casinoNames.has(row.name) || row.columns?.some(name => casinoColumns.has(row.table_name + '.' + name));
    assert.deepEqual(rows.filter(selected), expected.constraints, 'Only the exact PG18 casino NOT NULL constraints qualify');
    return rows.filter(row => !selected(row));
  }
  return rows;
}
export function questingCasinoCatalogProjection(metadata, version, profile, flags) {
  assert.deepEqual(Object.keys(metadata).sort(), [...fields].sort());
  return Object.fromEntries(fields.map(field => [field, questingCasinoCatalogRows(field, metadata[field], version, profile, flags)]));
}
export function questingCasinoConstraintProjection(rows, version, includeNotNull) {
  assert(Array.isArray(rows)); assert(version === 16 || version === 18); assert.equal(typeof includeNotNull, 'boolean');
  const expected = version === 18 && includeNotNull ? ['rake_index', 'rake_legacy_owners'].map(name => ({ table_name: 'den_volume',
    name: 'den_volume_' + name + '_not_null', definition: 'NOT NULL ' + name })) : [];
  assert.deepEqual(rows.filter(row => casinoNames.has(row.name)), expected, 'Exact casino constraints qualify before archived normalization');
  return rows.filter(row => !casinoNames.has(row.name));
}
export const QUESTING_CASINO_DDL_CONTROLS = Object.freeze([
  ...[ ['businesses', 'rake_index_cursor'], ['den_volume', 'rake_index'], ['den_volume', 'rake_checkpoint_volume'], ['den_volume', 'rake_legacy_owners'] ]
    .flatMap(([table, name]) => [`ALTER TABLE ${table} DROP COLUMN ${name}`, `ALTER TABLE ${table} ALTER COLUMN ${name} SET DEFAULT '1'`,
      `ALTER TABLE ${table} ALTER COLUMN ${name} TYPE varchar USING ${name}::varchar`]),
  'ALTER TABLE den_volume ALTER COLUMN rake_index DROP NOT NULL', 'ALTER TABLE den_volume ALTER COLUMN rake_legacy_owners DROP NOT NULL',
]);
export function questingCatalogProjection(reference, baseline, version) {
  assert.deepEqual(Object.keys(reference).sort(), [...fields].sort()); assert.deepEqual(Object.keys(baseline).sort(), [...fields].sort());
  validateAdded(reference, version);
  const project = metadata => Object.fromEntries(fields.map(field => [field, metadata[field].filter(row => !tables.has(field === 'relations' ? row.name : row.table_name))]));
  assert.deepEqual(project(reference), baseline, 'Every retained full native field equals the independently compiled582 blueprint');
  freeze(reference); freeze(baseline);
  const verify = metadata => {
    assert.deepEqual(Object.keys(metadata).sort(), [...fields].sort());
    for (const field of fields) { assert(Array.isArray(metadata[field])); assert.equal(metadata[field].length, reference[field].length, `Complete quest585 ${field}`);
      for (let i = 0; i < reference[field].length; i++) if (metadata[field][i] !== reference[field][i]) assert.deepEqual(metadata[field][i], reference[field][i], `Complete quest585 ${field}[${i}]`); }
    return true;
  };
  let causal = 0;
  for (const field of fields) for (const [i, row] of reference[field].entries()) if (tables.has(field === 'relations' ? row.name : row.table_name)) {
    for (const changed of [reference[field].filter((_, index) => index !== i), [...reference[field], row],
      reference[field].map((value, index) => index === i ? { ...value, unreviewed: true } : value)]) {
      assert.throws(() => verify({ ...reference, [field]: changed })); causal++;
    }
    for (const property of Object.keys(row)) {
      const changed = { ...row, [property]: typeof row[property] === 'boolean' ? !row[property] : ['unreviewed'] };
      assert.throws(() => verify({ ...reference, [field]: reference[field].map((value, index) => index === i ? changed : value) })); causal++;
    }
  }
  return Object.freeze({ reference, baseline, verify, project, causal });
}
async function nativeCaller(pool, endpoint, source) {
  const input = questingCatalogSource(source), raw = uniform(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  assert.equal(input.current, raw, 'Native DDL is the complete physical current schema');
  const { assertQuestingEnterpriseTrackedInput } = await import('./enterprise-native-questing.js');
  const record = revision => { const line = git('ls-tree', '-z', revision, '--', 'schema.sql').toString('utf8');
    const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\tschema\.sql\0$/); assert(match); return { type: 'blob', mode: match[1], blob: match[2] }; };
  const { QUESTING_ENTERPRISE_NATIVE_INPUTS: declaration } = await import('./enterprise-native-questing-inputs.js');
  assertQuestingEnterpriseTrackedInput('schema.sql', record('HEAD'), record(declaration.authoredRevision), Buffer.from(raw));
  assert.equal(process.execArgv.length, 0); assert.equal(process.argv.length, 3); assert.equal(process.argv[2], '--postgres');
  assert(String(process.argv[1]).replaceAll('\\', '/').endsWith('/test/enterprise-release-phase2-migration-catalog.js'));
  const key = 'ENTERPRISE_NATIVE_CATALOG_TEST_DATABASE_URL';
  for (const name of Object.keys(process.env)) {
    if (/DATABASE_URL$/i.test(name)) assert.equal(name, key);
    else assert(!/^PG|^RC1|^P2_TEST/i.test(name) && !['NODE_OPTIONS', 'NODE_PATH', 'NODE_PG_FORCE_NATIVE', 'LEGAL_PROFILE_DEFER', 'GENESIS_AUCTION_MANIFEST_PATH', 'GENESIS_AUCTION_MANIFEST_SHA256'].includes(name.toUpperCase()));
  }
  assert.equal(process.env.CHAIN_ENABLED, 'off'); assert.equal(process.env.RESOURCE_ECONOMY, 'off');
  const address = new URL(endpoint); assert.equal(new URL(process.env[key]).href, address.href);
  assert(['postgres:', 'postgresql:'].includes(address.protocol)); assert.equal(address.hostname, '127.0.0.1'); assert(!address.search && !address.hash);
  assert.match(address.pathname, /^\/enterprise_native_catalog_test_[a-f0-9]{12}$/);
  const local = ['35439', '35449'].includes(address.port) && address.username === 'pilot_runner' && !address.password;
  assert(local || address.port === '5432' && address.username === 'postgres' && address.password === 'pgcheck');
  const row = (await pool.query("SELECT current_user AS role,current_database() AS database,current_schema() AS schema,current_setting('server_version') AS version,current_setting('data_directory') AS directory,(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner")).rows[0];
  assert.equal(row.role, address.username); assert.equal(row.owner, row.role); assert.equal('/' + row.database, address.pathname); assert.equal(row.schema, 'public');
  assert.match(row.version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
  if (local) assert.equal(row.directory.replaceAll('\\', '/').toLowerCase(), { '35439': 'c:/users/jorge/appdata/local/temp/omerta-economy-oct15-pg184', '35449': 'c:/users/jorge/appdata/local/temp/omerta-employment-pg184-proof' }[address.port]);
  await emptyNamespace(pool); return { input, address, version: Number(row.version.split('.')[0]) };
}
async function emptyNamespace(pool) {
  assert.deepEqual((await pool.query("SELECT nspname FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema' ORDER BY nspname")).rows.map(row => row.nspname), ['public']);
  assert.deepEqual((await pool.query("SELECT c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,c.relkind")).rows, []);
}
export async function verifyQuestingEnterpriseCatalog(pool, endpoint, source) {
  const { input, address, version } = await nativeCaller(pool, endpoint, source);
  const { default: pg } = await import('pg');
  const compiler = await import('./commerce-deed-release-phase2-native-catalog.js');
  const readMetadata = async client => {
    const metadata = await compiler.readCommerceReleasePhase2Metadata(client);
    const flags = (await client.query(`SELECT t.relname::text AS table_name,c.conname::text AS name,
      c.connoinherit AS no_inherit,c.conislocal AS is_local,c.coninhcount AS inheritance_count
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname=current_schema() ORDER BY t.relname,c.conname`)).rows;
    assert.equal(flags.length, metadata.constraints.length);
    return { ...metadata, constraints: metadata.constraints.map((row, i) => {
      assert.equal(flags[i].table_name, row.table_name); assert.equal(flags[i].name, row.name);
      assert.deepEqual(Object.keys(flags[i]).sort(), ['table_name', 'name', 'no_inherit', 'is_local', 'inheritance_count'].sort());
      return { ...row, no_inherit: flags[i].no_inherit, is_local: flags[i].is_local, inheritance_count: flags[i].inheritance_count };
    }) };
  };
  const historicalSource = git('show', '52c582d7859843e02f45ed5d5c2377c996dd43da:schema.sql').toString('utf8');
  assert.equal(sha(historicalSource), '833373245ddb1ce5a3c9ed386a9b3245d81ddb0bdb51e75d1e5ffee2a7684335');
  let ddlCausal = 0;
  const compile = async (sources, inspect) => {
    const name = 'release_phase2_ref_' + crypto.randomBytes(8).toString('hex'); let created = false, client, failure;
    try {
      assert.deepEqual((await pool.query('SELECT nspname FROM pg_namespace WHERE nspname=$1', [name])).rows, []);
      await pool.query(`CREATE SCHEMA ${name}`); created = true;
      const url = new URL(address); url.searchParams.set('options', `-c search_path=${name} -c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000`);
      client = new pg.Client({ connectionString: url.href }); await client.connect();
      const settings = (await client.query("SELECT current_schema() AS schema,current_database() AS database,current_user AS role,current_setting('statement_timeout') AS timeout,current_setting('lock_timeout') AS lock_timeout")).rows[0];
      assert.equal(settings.schema, name); assert.equal('/' + settings.database, address.pathname); assert.equal(settings.role, address.username); assert.equal(settings.timeout, '30s'); assert.equal(settings.lock_timeout, '5s');
      for (const ddl of sources) await client.query(ddl);
      const metadata = await readMetadata(client);
      const expectedTables = [...sources.at(-1).matchAll(/^CREATE TABLE IF NOT EXISTS (\w+)/gm)].map(row => row[1]).sort();
      assert.deepEqual(metadata.relations.filter(row => row.kind === 'r' || row.kind === 'p').map(row => row.name).sort(), expectedTables,
        'Every actual authored table is observed, including all seven retained UX tables');
      if (inspect) await inspect(client, metadata); return metadata;
    } catch (error) { failure = error; throw error; }
    finally {
      const cleanupFailures = [];
      try { if (client) await client.end(); } catch (error) { cleanupFailures.push(error); }
      try { if (created) { assert.equal((await pool.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1', [name])).rows[0]?.mine, true); await pool.query(`DROP SCHEMA ${name} CASCADE`); } }
      catch (error) { cleanupFailures.push(error); }
      if (cleanupFailures.length) { if (!failure) throw new AggregateError(cleanupFailures, 'Native schema cleanup failed'); failure.cleanupFailures = cleanupFailures.map(error => error.message); }
    }
  };
  const current = await compile([input.current]);
  const archivedBaseline = await compile([input.archivedBaseline]);
  let casinoDdlCausal = 0;
  const baseline = await compile([input.baseline], async (client, metadata) => {
    assert.deepEqual(questingCasinoCatalogProjection(metadata, version, 'fresh', true), archivedBaseline,
      'Only the independently specified four fields differ from every archived582 metadata field');
    for (const ddl of QUESTING_CASINO_DDL_CONTROLS) {
      await client.query('BEGIN');
      try { await client.query(ddl); const changed = await readMetadata(client);
        assert.throws(() => questingCasinoCatalogProjection(changed, version, 'fresh', true)); casinoDdlCausal++; }
      finally { await client.query('ROLLBACK'); }
      assert.deepEqual(questingCasinoCatalogProjection(await readMetadata(client), version, 'fresh', true), archivedBaseline);
    }
  });
  const projection = questingCatalogProjection(current, baseline, version);
  const upgraded = await compile([input.baseline, input.current], async (client, metadata) => {
    projection.verify(metadata);
    const ddls = [
      ...QUESTING_CATALOG_TABLES.map(table => `ALTER TABLE ${table} ADD COLUMN unreviewed TEXT`),
      ...Object.entries(foreign).map(([name, [table]]) => `ALTER TABLE ${table} DROP CONSTRAINT ${name}`),
      'ALTER TABLE quest_workshop_mysteries DROP CONSTRAINT quest_workshop_mysteries_status_check',
      'ALTER TABLE quest_workshop_plays DROP CONSTRAINT quest_workshop_plays_stars_check',
      'ALTER TABLE quest_workshop_mysteries ALTER COLUMN author_credit DROP NOT NULL',
      'ALTER TABLE quest_workshop_plays ALTER COLUMN attempts SET DEFAULT 42',
      'DROP INDEX ix_quest_workshop_author', 'DROP INDEX ix_quest_workshop_published',
    ];
    for (const ddl of ddls) {
      await client.query('BEGIN');
      try { await client.query(ddl); const observed = await readMetadata(client);
        assert.throws(() => projection.verify(observed)); ddlCausal++; }
      finally { await client.query('ROLLBACK'); }
      projection.verify(await readMetadata(client));
    }
  });
  projection.verify(upgraded);
  assert.deepEqual(projection.project(upgraded), baseline); await emptyNamespace(pool);
  const historical = await compiler.verifyCommerceEnterpriseSlotBranches(pool, endpoint, historicalSource);
  await emptyNamespace(pool);
  return freeze({ current, upgraded, baseline, archivedBaseline, historical, causal: projection.causal, ddlCausal, casinoDdlCausal, actualTables: 585, baselineTables: 582,
    phase: 'actual quest585 fresh and current582→585 native upgrade; exact four-field archived582 comparison; legacy casino migration is separate' });
}
