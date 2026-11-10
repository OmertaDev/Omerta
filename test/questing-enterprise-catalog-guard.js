import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import './task-puzzle-native-catalog-guard.js';
import { questingCatalogSource, questingCatalogProjection, QUESTING_CATALOG_COLUMNS as columns,
  QUESTING_CATALOG_TABLES as tables, questingCasinoCatalogProjection } from '../tools/questing-enterprise-catalog.js';

const raw = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
assert.throws(() => questingCatalogSource(raw), /Exact complete actual quest585/);
const pinned585 = execFileSync('git', ['--no-replace-objects', 'cat-file', 'blob', '86b671c5d6f6928ff3e66f1ad0fca5f46a7364e3'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const source = questingCatalogSource(pinned585);
assert.equal(questingCatalogSource(source.current.replaceAll('\n', '\r\n')).current, source.current);
let refusals = 0;
for (const bad of [source.baseline, source.archivedBaseline, source.archived, source.current + '\n', source.current.slice(1), '\ufeff' + source.current,
  source.current.replace('\n', '\r\n'), source.current.replace('stars BETWEEN 1 AND 5', 'stars BETWEEN 0 AND 5'),
  source.current.replace('author_account_id TEXT NOT NULL REFERENCES accounts(id)', 'author_account_id TEXT'),
  source.current.replace('quest_reading_room', 'unreviewed_reading_room'), source.current.replace('rake_index_cursor TEXT', 'rake_index_cursor VARCHAR'),
  source.current.replace('rake_checkpoint_volume NUMERIC', 'rake_checkpoint_volume NUMERIC(20,2)'),
  source.current.replace("rake_index TEXT NOT NULL DEFAULT '0'", "rake_index TEXT NOT NULL DEFAULT '1'")]) {
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
let casinoRefusals = 0, casinoProfiles = 0;
for (const version of [16, 18]) for (const profile of ['fresh', 'phase2', 'director']) for (const flags of [false, true]) {
  const business = ['id','character_id','kind','tier','last_collect_at','launder_used','launder_at','scrutiny','scrutiny_at','shakedown_at','inside_at','rake_cursor','upkeep_at','acquired_at','spec','spec_at','takeover_cd_until'];
  const volume = ['id','total','profit','distributed','jackpot'];
  const legacy = { relations: [], columns: [['businesses',business],['den_volume',volume]].flatMap(([table,names]) =>
    names.map((column_name,i) => ({ table_name:table,column_name,ordinal:i+1 }))), constraints:[], indexes:[] };
  const names = profile === 'fresh' ? [business.toSpliced(12,0,'rake_index_cursor'),volume.toSpliced(4,0,'rake_index','rake_checkpoint_volume','rake_legacy_owners')]
    : [[...business,'rake_index_cursor'],[...volume,'rake_index','rake_checkpoint_volume','rake_legacy_owners']];
  const specs = { rake_index_cursor:['text',false,null],rake_index:['text',true,"'0'::text"],rake_checkpoint_volume:['numeric',false,null],rake_legacy_owners:['integer',true,'0'] };
  const live = { ...structuredClone(legacy), columns: [['businesses',names[0]],['den_volume',names[1]]].flatMap(([table,columns]) => columns.map((name,i) => {
    const row = { table_name:table,column_name:name,ordinal:i+1 }; if (!specs[name]) return row;
    const [type,not_null,default_expression] = specs[name]; return {...row,type,not_null,default_expression,typmod:-1,identity:'',generated:'',collation_schema:type==='text'?'pg_catalog':null,collation_name:type==='text'?'default':null};
  })) };
  if (version === 18) live.constraints = ['rake_index','rake_legacy_owners'].map(name => ({table_name:'den_volume',name:'den_volume_'+name+'_not_null',type:'n',validated:true,deferrable:false,deferred:false,definition:'NOT NULL '+name,match_type:' ',update_action:' ',delete_action:' ',referenced_schema:null,referenced_table:null,columns:[name],referenced_columns:[],...(flags?{no_inherit:false,is_local:true,inheritance_count:0}:{})}));
  const project = value => questingCasinoCatalogProjection(value,version,profile,flags);
  assert.deepEqual(project(live),legacy); casinoProfiles++;
  const reject = change => { const bad=structuredClone(live);change(bad);assert.throws(()=>project(bad));casinoRefusals++; };
  for (const [index,row] of live.columns.entries()) if (specs[row.column_name]) {
    reject(value=>value.columns.splice(index,1)); reject(value=>value.columns.splice(index,0,{...row}));
    for (const key of Object.keys(row)) reject(value=>{const old=value.columns[index][key];value.columns[index][key]=typeof old==='boolean'?!old:typeof old==='number'?old+1:old===null?'unknown':old+'unknown';});
  }
  for (const [index,row] of live.constraints.entries()) {
    reject(value=>value.constraints.splice(index,1)); reject(value=>value.constraints.push({...row}));
    for (const key of Object.keys(row)) reject(value=>{value.constraints[index][key]=typeof row[key]==='boolean'?!row[key]:'unknown';});
  }
  reject(value=>value.columns.splice(value.columns.findIndex(row=>row.column_name==='rake_cursor'),1));
  reject(value=>{value.columns.find(row=>row.column_name==='upkeep_at').ordinal++;});
  reject(value=>value.columns.push({table_name:'den_volume',column_name:'rake_unknown',ordinal:9}));
  reject(value=>{value.columns.find(row=>row.column_name==='rake_index_cursor').ordinal=15;});
  reject(value=>{value.columns.find(row=>row.column_name==='rake_index').ordinal=profile==='fresh'?6:5;});
}
console.log(JSON.stringify({ phase: 'QUESTING_ACTUAL_CATALOG_SOURCE_GUARDS', rawActualTables: 585, rawBaselineTables: 582,
  explicitRefusals: refusals, syntheticFullFieldCausalRefusals: causal, casinoProfiles, casinoRefusals, syntheticFixturesOnly: true, nativeExecution: false }));
