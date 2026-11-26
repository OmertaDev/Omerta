// Synthetic catalog rows prove this validator, never PostgreSQL/catalog qualification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { deedPrimaryCatalogSource, verifyDeedPrimaryCatalogDelta, deedPrimaryComparisonMetadata,
  deedPrimaryCatalogProjection, deedPrimaryComparisonConstraints, requireDeedPrimaryComparisonContext,
  DEED_PRIMARY_DDL_CONTROLS } from '../tools/deed-primary-native-catalog.js';

const raw = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const source = deedPrimaryCatalogSource(raw), historical = execFileSync('git', ['--no-replace-objects', 'cat-file', 'blob', '511950e2a68d50cebebe6139098a5dbb609117c9'], { encoding: 'utf8', maxBuffer: 4e6 });
assert.equal(source.current, raw.replaceAll('\r\n', '\n')); assert.equal(source.predecessor, historical);
assert.deepEqual([source.actualTables, source.baselineTables, source.sourceOnly, source.nativeAdmission, source.priorResultsTransferred], [587, 586, true, false, false]);
assert.equal(deedPrimaryCatalogSource(source.current.replaceAll('\n', '\r\n')).current, source.current);
let refusals = 0, profiles = 0;
const reject = fn => { assert.throws(fn, error => error?.code === 'ERR_ASSERTION'); refusals++; };
for (const bad of [historical, source.current + '\n', source.current.slice(1), '\ufeff' + source.current, source.current.replace('\n', '\r\n'), source.current.replace('issuance_kind TEXT CHECK', 'issuance_kind TEXT NOT NULL CHECK'), source.current.replace('primary_issuance_receipt JSONB', 'primary_issuance_receipt TEXT'), source.current.replace('name_lc TEXT NOT NULL UNIQUE,\n  district TEXT NOT NULL,\n  building_id TEXT NOT NULL UNIQUE', 'name_lc TEXT NOT NULL,\n  district TEXT NOT NULL,\n  building_id TEXT NOT NULL UNIQUE'), source.current.replace('burn_receipt JSONB;\n', 'burn_receipt JSONB DEFAULT \'{}\';\n')]) reject(() => deedPrimaryCatalogSource(bad));
for (const bad of [{}, Object.freeze({ validated: true }), Object.freeze({ actualTables: 587, native: true }), JSON.parse(JSON.stringify(source))]) reject(() => requireDeedPrimaryComparisonContext(bad));

const fields = ['relations', 'columns', 'constraints', 'indexes'];
const oldStreet = 'account_id name name_lc district claimed_at building_id controller_account control_until corner_at shakedown_at home_authority_token sale_price onchain_token_id onchain_owner extracted_by_account extracted_at attested_at ownership_since_day'.split(' ');
const added = ['issuance_kind', 'primary_issuance_receipt', 'last_burn_receipt', 'last_extraction_receipt'];
const legacy = oldStreet.filter(name => !['building_id', 'home_authority_token', 'ownership_since_day'].includes(name));
const streetProfiles = { fresh: [...oldStreet.slice(0, 6), ...added, ...oldStreet.slice(6)], upgrade586: [...oldStreet, ...added], phase2: [...legacy, 'building_id', ...added, 'home_authority_token', 'ownership_since_day'], director: [...legacy, 'building_id', ...added, 'home_authority_token', 'ownership_since_day'] };
const burn = 'ref wallet_address token_id status applied_account created_at applied_at'.split(' ');
const column = (table_name, column_name, ordinal, type = 'text', not_null = false, default_expression = null) => ({ table_name, column_name, ordinal, type, typmod: -1, default_expression, not_null, identity: '', generated: '', collation_schema: type === 'text' ? 'pg_catalog' : null, collation_name: type === 'text' ? 'default' : null });
const constraint = (table_name, name, type, definition, columns, flags) => ({ table_name, name, type, validated: true, deferrable: false, deferred: false, definition, match_type: ' ', update_action: ' ', delete_action: ' ', referenced_schema: null, referenced_table: null, columns, referenced_columns: [], ...(flags ? { no_inherit: ['p', 'f', 'u'].includes(type), is_local: true, inheritance_count: 0 } : {}) });
const order = (a, b) => a.table_name < b.table_name ? -1 : a.table_name > b.table_name ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
function fixture(version, profile, flags) {
  const names = streetProfiles[profile], old = names.filter(name => !added.includes(name));
  const baseline = { relations: [{ name: 'deed_reimports', kind: 'r', persistence: 'p' }, { name: 'street_deeds', kind: 'r', persistence: 'p' }], columns: [...burn.map((name, i) => column('deed_reimports', name, i + 1)), ...old.map((name, i) => column('street_deeds', name, i + 1))], constraints: [], indexes: [], sequences: { definition: [], ownership: [], bindings: [] } };
  const live = structuredClone(baseline);
  live.relations.splice(1, 0, { name: 'street_deed_paid_intents', kind: 'r', persistence: 'p' });
  live.columns = [...baseline.columns.filter(row => row.table_name === 'deed_reimports'), column('deed_reimports', 'burn_receipt', 8, 'jsonb'), ...['account_id', 'name', 'name_lc', 'district', 'building_id', 'created_at'].map((name, i) => column('street_deed_paid_intents', name, i + 1, name === 'created_at' ? 'timestamp with time zone' : 'text', true, name === 'created_at' ? 'now()' : null)), ...names.map((name, i) => added.includes(name) ? column('street_deeds', name, i + 1, name === 'issuance_kind' ? 'text' : 'jsonb') : { ...baseline.columns.find(row => row.table_name === 'street_deeds' && row.column_name === name), ordinal: i + 1 })];
  live.constraints = [constraint('street_deeds', 'street_deeds_issuance_kind_check', 'c', "CHECK (issuance_kind = ANY (ARRAY['gameplay'::text, 'paid'::text, 'partnership'::text]))", ['issuance_kind'], flags)];
  for (const [suffix, name, primary] of [['pkey', 'account_id', true], ['name_lc_key', 'name_lc', false], ['building_id_key', 'building_id', false]]) {
    live.constraints.push(constraint('street_deed_paid_intents', `street_deed_paid_intents_${suffix}`, primary ? 'p' : 'u', `${primary ? 'PRIMARY KEY' : 'UNIQUE'} (${name})`, [name], flags));
    live.indexes.push({ table_name: 'street_deed_paid_intents', name: `street_deed_paid_intents_${suffix}`, definition: `CREATE UNIQUE INDEX street_deed_paid_intents_${suffix} ON $self.street_deed_paid_intents USING btree (${name})`, unique: true, primary, valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null });
  }
  if (version === 18) for (const row of live.columns.filter(row => row.table_name === 'street_deed_paid_intents')) live.constraints.push(constraint(row.table_name, `${row.table_name}_${row.column_name}_not_null`, 'n', `NOT NULL ${row.column_name}`, [row.column_name], flags));
  live.constraints.sort(order); live.indexes.sort(order); return { baseline, live };
}
for (const version of [16, 18]) for (const profile of Object.keys(streetProfiles)) for (const flags of [false, true]) {
  const { baseline, live } = fixture(version, profile, flags), proof = deedPrimaryCatalogProjection(live, baseline, version, profile, flags); profiles++;
  assert.equal(verifyDeedPrimaryCatalogDelta(live, version, profile, flags), true); assert.equal(proof.verify(live), true);
  assert.deepEqual(deedPrimaryComparisonMetadata(live, version, profile, flags), baseline);
  for (const includeNotNull of [true, false]) {
    const rows = live.constraints.filter(row => includeNotNull || row.type !== 'n').map(({ table_name, name, definition }) => ({ table_name, name, definition }));
    assert.deepEqual(deedPrimaryComparisonConstraints(rows, version, includeNotNull, profile), []);
    reject(() => deedPrimaryComparisonConstraints([...rows, { table_name: 'street_deeds', name: 'unknown', definition: 'CHECK (issuance_kind IS NULL)', columns: ['issuance_kind'] }], version, includeNotNull, profile));
  }
  for (const field of fields) for (const [i, row] of live[field].entries()) {
    const relevant = field === 'relations' ? row.name === 'street_deed_paid_intents' : row.table_name === 'street_deed_paid_intents' || row.column_name === 'burn_receipt' || added.includes(row.column_name) || row.columns?.includes('issuance_kind');
    if (!relevant) continue;
    for (const change of [value => value[field].splice(i, 1), value => value[field].push({ ...row }), value => { value[field][i].unknown = true; }, ...Object.keys(row).map(key => value => { value[field][i][key] = typeof row[key] === 'boolean' ? !row[key] : typeof row[key] === 'number' ? row[key] + 1 : 'changed'; })]) { const bad = structuredClone(live); change(bad); reject(() => proof.verify(bad)); }
  }
  for (const change of [value => { value.columns.find(row => row.table_name === 'street_deeds' && row.column_name === 'ownership_since_day').ordinal++; }, value => value.columns.push(column('street_deeds', 'unknown', 23)), value => value.columns.push(column('deed_reimports', 'unknown', 9)), value => value.relations.push({ name: 'unknown', kind: 'r', persistence: 'p' }), value => { value.columns[0].type = 'unknown'; }, value => { value.sequences.definition.push({ name: 'unknown' }); }]) { const bad = structuredClone(live); change(bad); reject(() => proof.verify(bad)); }
  for (const other of Object.keys(streetProfiles).filter(other => other !== profile && !['phase2', 'director'].every(name => [other, profile].includes(name)))) reject(() => verifyDeedPrimaryCatalogDelta(live, version, other, flags));
}
assert(DEED_PRIMARY_DDL_CONTROLS.length > 25); assert.equal(new Set(DEED_PRIMARY_DDL_CONTROLS).size, DEED_PRIMARY_DDL_CONTROLS.length);
for (const file of ['phase2-postgres.js', 'director-migration.js']) {
  const caller = fs.readFileSync(new URL('./' + file, import.meta.url), 'utf8');
  assert.match(caller, /createDeedPrimaryReleasePhase2MigrationCatalog as createCommerceReleasePhase2MigrationCatalog/);
  assert.match(caller, /readDeedPrimaryReleasePhase2Metadata as readCommerceReleasePhase2Metadata/);
  assert.match(caller, /verifyDeedPrimaryReleasePhase2CausalNegatives as verifyCommerceReleasePhase2CausalNegatives/);
  assert.match(caller, /assertDeedPrimaryPhase2SourceInputs as assertQuestingPhase2SourceInputs/);
  assert.match(caller, /from '\.\.\/tools\/deed-primary-native-catalog\.js'/);
}
console.log(JSON.stringify({ phase: 'DEED_PRIMARY587_PURE_SOURCE_AND_SYNTHETIC_CATALOG', profiles, refusals, ddlControls: DEED_PRIMARY_DDL_CONTROLS.length, nativeAttempts: 0, priorResultsTransferred: false }));
