import assert from 'node:assert/strict';
import fs from 'node:fs';
import { questingCatalogSource, questingCatalogProjection, QUESTING_CATALOG_COLUMNS as columns,
  QUESTING_CATALOG_TABLES as tables } from '../tools/questing-enterprise-catalog.js';

const raw = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const source = questingCatalogSource(raw);
assert.equal(questingCatalogSource(source.current.replaceAll('\n', '\r\n')).current, source.current);
let refusals = 0;
for (const bad of [source.baseline, source.current + '\n', source.current.slice(1), '\ufeff' + source.current,
  source.current.replace('\n', '\r\n'), source.current.replace('stars BETWEEN 1 AND 5', 'stars BETWEEN 0 AND 5'),
  source.current.replace('author_account_id TEXT NOT NULL REFERENCES accounts(id)', 'author_account_id TEXT'),
  source.current.replace('quest_reading_room', 'unreviewed_reading_room')]) {
  assert.throws(() => questingCatalogSource(bad)); refusals++;
}
const baseline = { relations: [{ name: 'accounts', kind: 'r', persistence: 'p' }], columns: [], constraints: [], indexes: [] };
function fixture(version) {
  const metadata = structuredClone(baseline), primary = { quest_workshop_mysteries: ['id'], quest_workshop_plays: ['mystery_id', 'account_id'], quest_reading_room: ['account_id', 'day_ordinal'] };
  const constraint = (table, name, type, cols, definition) => ({ table_name: table, name, type, validated: true, deferrable: false, deferred: false,
    definition, match_type: ' ', update_action: ' ', delete_action: ' ',
    referenced_schema: null, referenced_table: null, columns: cols, referenced_columns: [],
    no_inherit: type === 'p' || type === 'f', is_local: true, inheritance_count: 0 });
  for (const table of tables) {
    metadata.relations.push({ name: table, kind: 'r', persistence: 'p' });
    for (const [i, [name, type, required, value]] of columns[table].entries()) {
      metadata.columns.push({ table_name: table, column_name: name, ordinal: i + 1, type, typmod: -1, default_expression: value,
        not_null: required, identity: '', generated: '', collation_schema: type === 'text' ? 'pg_catalog' : null, collation_name: type === 'text' ? 'default' : null });
      if (version === 18 && required) metadata.constraints.push(constraint(table, `${table}_${name}_not_null`, 'n', [name], `NOT NULL ${name}`));
    }
    metadata.constraints.push(constraint(table, `${table}_pkey`, 'p', primary[table], `PRIMARY KEY (${primary[table].join(', ')})`));
  }
  for (const [table, column, target] of [['quest_workshop_mysteries', 'author_account_id', 'accounts'], ['quest_workshop_plays', 'mystery_id', 'quest_workshop_mysteries'],
    ['quest_workshop_plays', 'account_id', 'accounts'], ['quest_reading_room', 'account_id', 'accounts']]) {
    metadata.constraints.push({ ...constraint(table, `${table}_${column}_fkey`, 'f', [column], `FOREIGN KEY (${column}) REFERENCES ${target}(id)`), match_type: 's', update_action: 'a', delete_action: 'a',
      referenced_schema: '$self', referenced_table: target, referenced_columns: ['id'] });
  }
  metadata.constraints.push(constraint('quest_workshop_mysteries', 'quest_workshop_mysteries_status_check', 'c', ['status'],
    "CHECK (status = ANY (ARRAY['draft'::text, 'published'::text]))"),
  constraint('quest_workshop_plays', 'quest_workshop_plays_stars_check', 'c', ['stars'], 'CHECK (stars >= 1 AND stars <= 5)'));
  for (const [name, table, cols, unique] of [
    ...tables.map(table => [`${table}_pkey`, table, primary[table], true]),
    ['ix_quest_workshop_author', 'quest_workshop_mysteries', ['author_account_id'], false],
    ['ix_quest_workshop_published', 'quest_workshop_mysteries', ['status', 'published_at'], false],
  ]) metadata.indexes.push({ table_name: table, name, definition: `CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${name} ON $self.${table} USING btree (${cols.join(', ')})`,
    unique, primary: name.endsWith('_pkey'), valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null });
  return metadata;
}
let causal = 0;
for (const version of [16, 18]) {
  const reference = fixture(version), projection = questingCatalogProjection(reference, structuredClone(baseline), version);
  projection.verify(structuredClone(reference)); causal += projection.causal;
  for (const change of [
    value => { value.columns[0].ordinal++; }, value => { value.columns[0].collation_name = null; },
    value => { value.columns[0].not_null = false; }, value => { value.columns[0].default_expression = 'unreviewed'; },
    value => { value.constraints.find(row => row.type === 'f').delete_action = 'c'; },
    value => { value.constraints.find(row => row.type === 'f').referenced_table = 'characters'; },
    value => { value.indexes[0].ready = false; }, value => { value.indexes[0].predicate = '(stars > 0)'; },
    value => { value.relations[0].name = 'unreviewed_core'; }, value => { value.columns.push({ ...value.columns[0] }); },
  ]) { const bad = structuredClone(reference); change(bad); assert.throws(() => projection.verify(bad)); refusals++; }
  const wrongBaseline = structuredClone(baseline); wrongBaseline.relations[0].kind = 'v';
  assert.throws(() => questingCatalogProjection(structuredClone(reference), wrongBaseline, version)); refusals++;
  assert.throws(() => questingCatalogProjection(fixture(version === 16 ? 18 : 16), structuredClone(baseline), version)); refusals++;
  for (const change of [
    value => { value.constraints.find(row => row.name.endsWith('stars_check')).definition = 'CHECK (false)'; },
    value => { value.constraints.find(row => row.type === 'p').delete_action = 'c'; },
    value => { value.constraints.find(row => row.type === 'f').definition = 'FOREIGN KEY (account_id) REFERENCES characters(id)'; },
    value => { value.constraints[0].no_inherit = !value.constraints[0].no_inherit; },
    value => { value.constraints[0].is_local = false; }, value => { value.constraints[0].inheritance_count = 1; },
  ]) { const bad = fixture(version); change(bad); assert.throws(() => questingCatalogProjection(bad, structuredClone(baseline), version)); refusals++; }
}
console.log(JSON.stringify({ phase: 'QUESTING_ACTUAL_CATALOG_SOURCE_GUARDS', rawActualTables: 585, rawBaselineTables: 582,
  explicitRefusals: refusals, syntheticFullFieldCausalRefusals: causal, syntheticFixturesOnly: true, nativeExecution: false }));
