// Current native catalog evidence for earned properties. Historical admission stays closed.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {DEED_QUEST_SOURCE_DOMAINS, assertDeedQuestSourceTransfer} from './deed-quest-source-transfer.js';

export const DEED_MIGRATION_TABLES = Object.freeze(['street_deed_building_assignments',
  'street_deed_discoveries', 'street_deed_discovery_migrations', 'street_deed_primary_claims']);
const fields = ['relations', 'columns', 'constraints', 'indexes'];
const tables = new Set(DEED_MIGRATION_TABLES);
const sort = rows => rows.map(row => JSON.stringify(row)).sort();
const same = (actual, expected, message) => assert.deepEqual(sort(actual), sort(expected), message);
const key = row => `${row.table_name}.${row.name}`;
const identity = (field,row) => field==='relations'?row.name:field==='columns'?`${row.table_name}.${row.column_name}`:key(row);
const freeze = value => {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}
  return value;
};
const columns = Object.freeze({
  street_deed_building_assignments: ['building_id', 'street_name', 'assigned_at'],
  street_deed_discoveries: ['account_id', 'building_id', 'steps', 'last_step_at', 'qualified_at',
    'source', 'source_ref', 'policy_version', 'objective_evidence'],
  street_deed_discovery_migrations: ['id'],
  street_deed_primary_claims: ['account_id', 'street_name', 'building_id', 'source', 'claimed_at'],
});
const constraints = ['street_deed_building_assignments.street_deed_building_assignments_pkey',
  'street_deed_building_assignments.street_deed_building_assignments_street_name_key',
  'street_deed_discoveries.street_deed_discoveries_pkey',
  'street_deed_discoveries.street_deed_discoveries_source_check',
  'street_deed_discoveries.street_deed_discoveries_steps_check',
  'street_deed_discovery_migrations.street_deed_discovery_migrations_id_check',
  'street_deed_discovery_migrations.street_deed_discovery_migrations_pkey',
  'street_deed_primary_claims.street_deed_primary_claims_pkey'].sort();
const indexes = ['street_deed_building_assignments.street_deed_building_assignments_pkey',
  'street_deed_building_assignments.street_deed_building_assignments_street_name_key',
  'street_deed_discoveries.street_deed_discoveries_pkey',
  'street_deed_discovery_migrations.street_deed_discovery_migrations_pkey',
  'street_deed_primary_claims.street_deed_primary_claims_pkey', 'street_deeds.ix_street_deeds_building'].sort();
const freshColumns = ['controller_account', 'control_until', 'corner_at', 'shakedown_at',
  'home_authority_token', 'sale_price', 'onchain_token_id', 'onchain_owner',
  'extracted_by_account', 'extracted_at', 'attested_at', 'ownership_since_day'];
const remaps = Object.freeze({
  fresh: freshColumns.map((name, index) => [`street_deeds.${name}`, 6 + index, 7 + index]),
  phase2: [['street_deeds.home_authority_token', 16, 17], ['street_deeds.ownership_since_day', 17, 18]],
  director: [['street_deeds.home_authority_token', 16, 17], ['street_deeds.ownership_since_day', 17, 18]],
});
const buildingOrdinal = Object.freeze({fresh: 6, phase2: 16, director: 16});
const belongs = (field, row) => tables.has(field === 'relations' ? row.name : row.table_name)
  || field === 'columns' && row.table_name === 'street_deeds' && row.column_name === 'building_id'
  || field === 'indexes' && key(row) === 'street_deeds.ix_street_deeds_building';

// Pure verification is also used for mutation controls. It never qualifies a database by itself.
export function deedDiscoveryCatalogProjection(baseline, candidate, {profile, serverVersionNum, includeNotNull}) {
  assert(Object.hasOwn(remaps, profile), 'Closed current Deed native profile required');
  assert.equal(typeof includeNotNull, 'boolean');
  assert(serverVersionNum >= 160000 && serverVersionNum < 170000
    || serverVersionNum >= 180000 && serverVersionNum < 190000, 'Only PostgreSQL16/18 catalog forms are admitted');
  const expected = freeze(structuredClone(candidate)), prior = structuredClone(baseline);
  for (const field of fields) assert(Array.isArray(expected[field]) && Array.isArray(prior[field]));
  const added = Object.fromEntries(fields.map(field => [field, expected[field].filter(row => belongs(field, row))]));
  assert.deepEqual(added.relations.map(row => row.name).sort(), [...DEED_MIGRATION_TABLES], 'Exactly four new Deed relations');
  assert(added.relations.every(row => row.kind === 'r' && row.persistence === 'p'));
  assert.equal(expected.relations.length, prior.relations.length + 4);
  for (const [table, names] of Object.entries(columns)) {
    const actual = added.columns.filter(row => row.table_name === table).sort((a,b) => a.ordinal - b.ordinal);
    assert.deepEqual(actual.map(row => row.column_name), names, `Exact current Deed column inventory: ${table}`);
    assert.deepEqual(actual.map(row => row.ordinal), names.map((_,index) => index + 1));
  }
  assert.equal(added.columns.length, 19, 'Eighteen new-table columns and one nullable building identity');
  assert.equal(added.columns.filter(row => row.not_null).length, 14);
  const building = added.columns.find(row => row.table_name === 'street_deeds');
  assert.equal(building.column_name, 'building_id'); assert.equal(building.ordinal, buildingOrdinal[profile]);
  assert.equal(building.type, 'text'); assert.equal(building.not_null, false); assert.equal(building.default_expression, null);
  assert.deepEqual(added.constraints.filter(row => row.type !== 'n').map(key).sort(), constraints);
  assert.equal(added.constraints.filter(row => row.type === 'n').length, serverVersionNum >= 180000 ? 14 : 0);
  assert(added.constraints.every(row => row.validated === true));
  assert.deepEqual(added.indexes.map(key).sort(), indexes);
  assert(added.indexes.every(row => row.unique && row.valid && row.ready && row.live));
  const originalColumns = new Map(prior.columns.map(row => [`${row.table_name}.${row.column_name}`, row]));
  const actualRemaps = expected.columns.filter(row => !belongs('columns', row)).flatMap(row => {
    const identity = `${row.table_name}.${row.column_name}`, old = originalColumns.get(identity);
    assert(old, 'No unknown prior column admitted by the Deed native layer');
    return row.ordinal === old.ordinal ? [] : [[identity, old.ordinal, row.ordinal]];
  });
  assert.deepEqual(actualRemaps.sort(), [...remaps[profile]].sort(), 'Only independently known Deed column-order changes');
  const project = metadata => Object.fromEntries(fields.map(field => [field,
    metadata[field].filter(row => !belongs(field, row)).map(row => field === 'columns'
      ? {...row, ordinal: originalColumns.get(`${row.table_name}.${row.column_name}`)?.ordinal ?? row.ordinal} : {...row})]));
  const initial = project(expected);
  for (const field of fields) same(initial[field], prior[field], `Every prior native ${field} remains exact after the complete Deed delta`);
  freeze(initial);
  const canonical = Object.fromEntries(fields.map(field => [field,new Map(expected[field].map(row=>[identity(field,row),row]))]));
  for(const field of fields)assert.equal(canonical[field].size,expected[field].length,'Canonical metadata has unique complete identities');
  const verifyMetadata = metadata => {
    for (const field of fields) {
      assert(Array.isArray(metadata[field]));assert.equal(metadata[field].length,canonical[field].size,`Complete current Deed ${field} count`);
      const seen=new Set();
      for(const row of metadata[field]) {
        const name=identity(field,row);
        assert(!seen.has(name)&&canonical[field].has(name),`Complete current Deed ${field}: unknown/duplicate identity`);seen.add(name);
        assert(isDeepStrictEqual(row,canonical[field].get(name)),`Complete current Deed ${field}: every row field remains exact`);
      }
    }
  };
  const projectMetadata = metadata => { verifyMetadata(metadata); return initial; };
  const expectedRows = added.constraints.filter(row => includeNotNull || row.type !== 'n')
    .map(({table_name, name, definition}) => ({table_name, name, definition}));
  const projectConstraints = rows => {
    same(rows.filter(row => tables.has(row.table_name)), expectedRows, 'Every Deed constraint is rechecked before historical projection');
    return rows.filter(row => !tables.has(row.table_name));
  };
  return Object.freeze({verifyMetadata, projectMetadata, projectConstraints,
    added: structuredClone(added), reference:expected, profile, sourceOnly: false,
    phase: 'current native catalog delta only; no historical, financial, activation or deployment clearance'});
}

export function deedDiscoveryMigrationSources(input) {
  const proof = assertDeedQuestSourceTransfer('schema.sql', input);
  assert.equal(proof.predecessorRevision, '2c8eaacf104e8555d5140136b5ed19027ecd4766');
  const current = input.replaceAll('\r\n', '\n'), predecessor = proof.baselineText;
  assert.equal([...current.matchAll(/^CREATE TABLE IF NOT EXISTS /gm)].length, 540);
  assert.equal([...predecessor.matchAll(/^CREATE TABLE IF NOT EXISTS /gm)].length, 536);
  return {current, predecessor, predecessorRevision: proof.predecessorRevision};
}
export function isDeedDiscoveryMigrationSource(input) {
  if (typeof input !== 'string') return false;
  const lf = input.replaceAll('\r\n', '\n');
  if (input !== lf && input !== lf.replaceAll('\n', '\r\n')) return false;
  return crypto.createHash('sha256').update(lf).digest('hex') === DEED_QUEST_SOURCE_DOMAINS['schema.sql'].currentSha256;
}
export function verifyDeedDiscoveryCatalogCausalNegatives(catalog, {includeNotNull}) {
  const original = catalog.reference;
  let refusals = 0;
  const reject = changed => {
    assert.throws(() => catalog.verifyMetadata(changed), error => error?.code === 'ERR_ASSERTION'); refusals++;
  };
  const altered = value => typeof value === 'boolean' ? !value : typeof value === 'number' ? value + 1
    : Array.isArray(value) ? [...value, '__unreviewed__'] : value === null ? '__unreviewed__' : value + '__unreviewed__';
  catalog.verifyMetadata(original);
  for (const field of fields) {
    const targets = original[field].map((row,index) => ({row,index})).filter(({row}) => belongs(field,row));
    const prior = original[field].findIndex(row => !belongs(field,row));
    if (prior >= 0) targets.push({row:original[field][prior],index:prior});
    for (const {row,index} of targets) {
      for (const property of Object.keys(row)) {
        const candidate = {...original,[field]:original[field].map((item,i)=>i===index?{...item,[property]:altered(row[property])}:item)};
        reject(candidate);
        const missingRow={...row};delete missingRow[property];
        reject({...original,[field]:original[field].map((item,i)=>i===index?missingRow:item)});
      }
      reject({...original,[field]:original[field].filter((_,i)=>i!==index)});
      reject({...original,[field]:[...original[field],{...row}]});
    }
    reject({...original,[field]:[...original[field],{...original[field][0],
      ...(field === 'relations' ? {name:'__unknown__'} : {table_name:'__unknown__'})}]});
  }
  const rows = original.constraints.filter(row => includeNotNull || row.type !== 'n')
    .map(({table_name,name,definition}) => ({table_name,name,definition}));
  catalog.projectConstraints(rows);
  for (let index=0; index<rows.length; index++) if(tables.has(rows[index].table_name)) {
    for (const change of [copy=>copy.splice(index,1),copy=>copy.push({...copy[index]}),
      copy=>{copy[index].name+='__unknown__';},copy=>{copy[index].definition+=' changed';}]) {
      const changed=rows.slice();changed[index]={...rows[index]};change(changed);
      assert.throws(()=>catalog.projectConstraints(changed), error=>error?.code==='ERR_ASSERTION'); refusals++;
    }
  }
  return refusals;
}

// compileReference and readMetadata are the existing native harness implementations, never game
// runtime adapters. Each independently compiled reference is retired before the next is created.
export async function createDeedDiscoveryMigrationCatalog(pool, endpoint, input,
  {profile, includeNotNull, compileReference, readMetadata, legacySchema}) {
  assert(Object.hasOwn(remaps, profile)); assert.equal(typeof compileReference, 'function'); assert.equal(typeof readMetadata, 'function');
  const sources = deedDiscoveryMigrationSources(input);
  const settings = (await pool.query("SELECT current_schema() AS schema,current_database() AS database,current_user AS role,current_setting('server_version_num') AS version,current_setting('server_version') AS server_version,(SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname=current_schema()) AS schema_owner")).rows[0];
  const address = new URL(endpoint);
  assert(['postgres:', 'postgresql:'].includes(address.protocol) && ['127.0.0.1','localhost','[::1]'].includes(address.hostname));
  assert(!address.search && !address.hash);
  assert(['/omerta_check','/omerta_query'].includes(address.pathname)
    || /^\/deed_discovery_catalog_test_[a-f0-9]{12}$/.test(address.pathname));
  const local = ['35439','35449'].includes(address.port) && address.username === 'pilot_runner' && !address.password;
  const ci = address.port === '5432' && address.username === 'postgres' && address.password === 'pgcheck';
  assert(local || ci, 'Only the existing owned local/CI native fixture endpoints are admitted');
  assert.equal(settings.role,address.username); assert.equal('/'+settings.database,address.pathname);
  assert.equal(settings.schema_owner,settings.role,'Only the current connection role owns its writable fixture schema');
  assert.match(settings.server_version,local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
  const version=Number(settings.version);
  assert(version>=160000&&version<170000||version>=180000&&version<190000,'Only native PostgreSQL16/18 before reference writes');
  const main=String(process.argv[1]).replaceAll('\\','/');
  const focused=main.endsWith('/test/deed-discovery-migration-catalog.js') && process.argv.length===3 && process.argv[2]==='--postgres'
    && /^\/deed_discovery_catalog_test_[a-f0-9]{12}$/.test(address.pathname);
  if(focused)assert.match(settings.schema,/^release_phase2_ref_[a-f0-9]{16}$/);
  else if(profile==='director') {
    assert(main.endsWith('/test/director-migration.js'));assert.match(settings.schema,/^director_migration_[a-f0-9]{16}$/);
  } else {
    assert(main.endsWith('/test/phase2-postgres.js'));assert.match(settings.schema,/^p2_definitions_[a-f0-9]{32}$/);
    assert.equal(process.env.P2_TEST_SCHEMA,settings.schema);
    assert.equal(process.env.P2_TEST_CHILD,profile==='fresh'?'lots':'upgrade');
  }
  const compile=source=>compileReference(pool,endpoint,source,{currentDeedHomeMigration:true});
  const baseline = await compile(sources.predecessor);
  const fresh = await compile(sources.current);
  const options = {serverVersionNum: version, includeNotNull};
  const freshCatalog = deedDiscoveryCatalogProjection(baseline, fresh, {...options, profile:'fresh'});
  let catalog = freshCatalog;
  if (profile !== 'fresh') {
    assert.equal(typeof legacySchema,'function');
    const legacy = legacySchema(profile);
    const before = await compile(legacy + '\n' + sources.predecessor);
    const upgraded = await compile(legacy + '\n' + sources.current);
    catalog = deedDiscoveryCatalogProjection(before, upgraded, {...options, profile});
    const replayed = await compile(legacy + '\n' + sources.current + '\n' + sources.current);
    catalog.verifyMetadata(replayed);
    same(upgraded.relations.filter(row=>tables.has(row.name)), fresh.relations.filter(row=>tables.has(row.name)), 'Fresh and upgraded new Deed relations agree');
    for (const field of ['columns','constraints','indexes']) same(upgraded[field].filter(row=>tables.has(row.table_name)),
      fresh[field].filter(row=>tables.has(row.table_name)), `Fresh and upgraded new Deed ${field} agree completely`);
  }
  const observed=await readMetadata(pool);
  try {catalog.verifyMetadata(observed);}
  catch(error) {
    const identity=(field,row)=>field==='relations'?row.name:field==='columns'?`${row.table_name}.${row.column_name}`:key(row);
    const delta={};
    for(const field of fields) {
      const expected=new Map(catalog.reference[field].map(row=>[identity(field,row),row]));
      const actual=new Map(observed[field].map(row=>[identity(field,row),row]));
      const missing=[...expected.keys()].filter(name=>!actual.has(name)),unknown=[...actual.keys()].filter(name=>!expected.has(name));
      const changed=[...actual].flatMap(([name,row])=>{
        const prior=expected.get(name);if(!prior)return [];
        const properties=Object.keys(row).filter(property=>JSON.stringify(row[property])!==JSON.stringify(prior[property]));
        return properties.length?[{name,properties}]:[];
      });
      if(missing.length||unknown.length||changed.length)delta[field]={missing:missing.slice(0,8),unknown:unknown.slice(0,8),changed:changed.slice(0,8),changedCount:changed.length};
    }
    console.error('Current Deed native catalog mismatch: '+JSON.stringify(delta));throw error;
  }
  const causalRefusals = verifyDeedDiscoveryCatalogCausalNegatives(catalog, {includeNotNull});
  console.log(`Current Deed native ${profile} catalog PASS: frozen536 plus4 tables/19 columns/8 structural constraints/14 NOT NULL declarations/6 indexes; ${causalRefusals} causal refusals; no inherited release clearance`);
  return Object.freeze({...catalog, predecessorSource:sources.predecessor, freshCatalog,
    source: {currentSha256:DEED_QUEST_SOURCE_DOMAINS['schema.sql'].currentSha256, predecessorRevision:sources.predecessorRevision}});
}
