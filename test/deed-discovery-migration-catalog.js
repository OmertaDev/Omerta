import {hasFinalServicesCommerceSource,finalServicesOverCommerceSourceBaseline} from '../tools/finalservices-commerce-source-compatibility.js';
const selectFinalServicesCommerceTestSource=(file,input)=>hasFinalServicesCommerceSource(file)?finalServicesOverCommerceSourceBaseline(file,String(input)):input;
// Synthetic catalog controls do not confer native qualification. --postgres compiles real sources.
import {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from "../tools/commerce-current-enterprise-source-compatibility.js";
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
import {enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';
import {commerceOverEnterpriseSourceBaseline} from '../tools/commerce-enterprise-source-compatibility.js';
import {migrateCityHomeStorage} from '../src/city-home-migration.js';
import {deedDiscoveryCatalogProjection, deedDiscoveryMigrationSources, isDeedDiscoveryMigrationSource,
  createDeedDiscoveryMigrationCatalog, verifyDeedDiscoveryCatalogCausalNegatives, DEED_MIGRATION_TABLES} from '../tools/deed-discovery-migration-catalog.js';
import {readNextLayerReleasePhase2Metadata, nextLayerMigrationPredecessor, nextLayerLegacySchema} from '../tools/next-layer-release-phase2-migration-catalog.js';
const rawSchema=fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8');
const schema=process.argv.includes('--postgres') || isDeedDiscoveryMigrationSource(rawSchema)
  ? rawSchema : enterpriseOverRootSourceBaseline('schema.sql',(hasCommerceCurrentEnterpriseSource('schema.sql')?commerceOverCurrentEnterpriseSourceBaseline('schema.sql',selectFinalServicesCommerceTestSource('schema.sql',rawSchema)):commerceOverEnterpriseSourceBaseline('schema.sql',selectFinalServicesCommerceTestSource('schema.sql',rawSchema))));
const sources=deedDiscoveryMigrationSources(schema);
assert(isDeedDiscoveryMigrationSource(schema));assert(isDeedDiscoveryMigrationSource(sources.current.replaceAll('\n','\r\n')));
assert.throws(()=>nextLayerMigrationPredecessor(schema),error=>error?.code==='ERR_ASSERTION','Raw current Deed source never enters the historical next-layer native adapter');
let refusals=0;
for(const source of[sources.current+'\n',sources.current.replace('\n','\r\n'),'\uFEFF'+sources.current,
  sources.predecessor,sources.current.replace('building_id','unknown_building_id')]) {
  assert(!isDeedDiscoveryMigrationSource(source));assert.throws(()=>deedDiscoveryMigrationSources(source));refusals++;
}
const column=(table_name,column_name,ordinal,not_null=false)=>({table_name,column_name,ordinal,type:'text',typmod:-1,
  default_expression:null,not_null,identity:'',generated:'',collation_schema:'pg_catalog',collation_name:'default'});
const constraint=(table_name,name,type='c')=>({table_name,name,type,validated:true,deferrable:false,deferred:false,
  definition:type==='n'?'NOT NULL':'CHECK (true)',match_type:' ',update_action:' ',delete_action:' ',
  referenced_schema:null,referenced_table:null,columns:['id'],referenced_columns:null});
const index=(table_name,name,primary=false)=>({table_name,name,definition:`CREATE UNIQUE INDEX ${name} ON $self.${table_name} USING btree (id)`,
  unique:true,primary,valid:true,ready:true,live:true,nulls_not_distinct:false,predicate:null});
const relation=name=>({name,kind:'r',persistence:'p'});
const originalColumns={fresh:['account_id','name','name_lc','district','claimed_at','controller_account','control_until','corner_at','shakedown_at',
  'home_authority_token','sale_price','onchain_token_id','onchain_owner','extracted_by_account','extracted_at','attested_at','ownership_since_day'],
phase2:['account_id','name','name_lc','district','claimed_at','controller_account','control_until','corner_at','shakedown_at',
  'sale_price','onchain_token_id','onchain_owner','extracted_by_account','extracted_at','attested_at','home_authority_token','ownership_since_day'],
director:['account_id','name','name_lc','district','claimed_at','controller_account','control_until','corner_at','shakedown_at',
  'sale_price','onchain_token_id','onchain_owner','extracted_by_account','extracted_at','attested_at','home_authority_token','ownership_since_day']};
const addedColumns={street_deed_building_assignments:[['building_id',true],['street_name',true],['assigned_at',true]],
street_deed_discoveries:[['account_id',true],['building_id',true],['steps',true],['last_step_at',false],['qualified_at',false],
  ['source',true],['source_ref',false],['policy_version',true],['objective_evidence',true]],
street_deed_discovery_migrations:[['id',true]],street_deed_primary_claims:[['account_id',true],['street_name',true],['building_id',false],['source',true],['claimed_at',true]]};
const structural={street_deed_building_assignments:[['pkey','p'],['street_name_key','u']],
street_deed_discoveries:[['pkey','p'],['source_check','c'],['steps_check','c']],
street_deed_discovery_migrations:[['id_check','c'],['pkey','p']],street_deed_primary_claims:[['pkey','p']]};
function synthetic(profile,version) {
  const baseline={relations:[relation('street_deeds'),...Array.from({length:535},(_,i)=>relation('prior_'+i))],
    columns:originalColumns[profile].map((name,i)=>column('street_deeds',name,i+1)),
    constraints:[constraint('street_deeds','street_deeds_pkey','p')],indexes:[index('street_deeds','street_deeds_pkey',true)]};
  const current=structuredClone(baseline),at={fresh:6,phase2:16,director:16}[profile];
  for(const row of current.columns) if(row.ordinal>=at)row.ordinal++;
  current.columns.push(column('street_deeds','building_id',at));
  current.indexes.push(index('street_deeds','ix_street_deeds_building'));
  for(const table of DEED_MIGRATION_TABLES) {
    current.relations.push(relation(table));
    current.columns.push(...addedColumns[table].map(([name,required],i)=>column(table,name,i+1,required)));
    for(const[suffix,type]of structural[table]) {
      const name=table+'_'+suffix;current.constraints.push(constraint(table,name,type));
      if(['p','u'].includes(type))current.indexes.push(index(table,name,type==='p'));
    }
    if(version>=180000)for(const[name,required]of addedColumns[table])if(required)current.constraints.push(constraint(table,table+'_'+name+'_not_null','n'));
  }
  return {baseline,current};
}
for(const version of[160000,180004])for(const profile of['fresh','phase2','director']) {
  const {baseline,current}=synthetic(profile,version);
  const catalog=deedDiscoveryCatalogProjection(baseline,current,{profile,serverVersionNum:version,includeNotNull:profile!=='director'});
  for(const field of Object.keys(baseline))assert.deepEqual(catalog.projectMetadata(current)[field].map(JSON.stringify).sort(),baseline[field].map(JSON.stringify).sort());
  const projected=catalog.projectMetadata(current);
  assert(Object.isFrozen(projected)&&Object.isFrozen(projected.columns)&&Object.isFrozen(projected.columns[0]));
  assert.throws(()=>{projected.columns[0].ordinal++;},TypeError);
  assert(Object.isFrozen(catalog.reference)&&Object.isFrozen(catalog.reference.columns)&&Object.isFrozen(catalog.reference.columns[0]));
  const mutable=structuredClone(current), originalType=mutable.columns[0].type;
  catalog.verifyMetadata(mutable);const initialProjection=catalog.projectMetadata(mutable);
  mutable.columns[0].type+='__unreviewed__';
  assert.throws(()=>catalog.verifyMetadata(mutable),error=>error?.code==='ERR_ASSERTION');
  assert.throws(()=>catalog.projectMetadata(mutable),error=>error?.code==='ERR_ASSERTION');refusals+=2;
  mutable.columns[0].type=originalType;catalog.verifyMetadata(mutable);
  assert.equal(catalog.projectMetadata(mutable),initialProjection,'Shared immutable result never caches acceptance of mutable input');
  refusals+=verifyDeedDiscoveryCatalogCausalNegatives(catalog,{includeNotNull:profile!=='director'});
  for(const wrong of['unreviewed',...(profile==='fresh'?['phase2','director']:['fresh'])]) {
    assert.throws(()=>deedDiscoveryCatalogProjection(baseline,current,{profile:wrong,serverVersionNum:version,includeNotNull:true}));refusals++;
  }
}
// A good synthetic admission reaches the compiler sentinel; each bad case changes one binding.
const fixtureDatabase='deed_discovery_catalog_test_'+'a'.repeat(12);
const goodAddress='postgresql://pilot_runner@127.0.0.1:35449/'+fixtureDatabase;
const goodSettings={schema:'release_phase2_ref_'+'a'.repeat(16),database:fixtureDatabase,role:'pilot_runner',
  schema_owner:'pilot_runner',version:'180004',server_version:'18.4'};
const originalArgv=[...process.argv];process.argv=[process.argv[0],process.argv[1],'--postgres'];
try {
  async function admission(settings,address,expectedWrites) {
    let writes=0;const sentinel=Error('compiler sentinel');
    const fake={async query(){return {rows:[settings]};}};
    await assert.rejects(()=>createDeedDiscoveryMigrationCatalog(fake,address,schema,{profile:'fresh',includeNotNull:true,
      compileReference:async()=>{writes++;throw sentinel;},readMetadata:async()=>({})}),
      error=>expectedWrites===1?error===sentinel:error?.code==='ERR_ASSERTION');
    assert.equal(writes,expectedWrites);if(!expectedWrites)refusals++;
  }
  await admission(goodSettings,goodAddress,1);
  for(const address of[goodAddress.replace('127.0.0.1','remote'),goodAddress.replace('35449','15449'),
    goodAddress.replace('pilot_runner','postgres'),goodAddress.replace(fixtureDatabase,'postgres'),goodAddress+'?options=unsafe'])
    await admission(goodSettings,address,0);
  for(const [property,value] of [['schema_owner','foreign'],['role','foreign'],['database','foreign'],
    ['schema','public'],['schema','director_migration_'+'a'.repeat(16)],['version','150000'],['server_version','17.1']])
    await admission({...goodSettings,[property]:value},goodAddress,0);
}finally{process.argv=originalArgv;}
console.log(`Current Deed catalog synthetic controls PASS: three profiles onPG16/18, ${refusals} refusing controls; no native qualification`);

if(process.argv.includes('--postgres')) {
  assert.equal(process.argv.length,3);assert(!process.env.DATABASE_URL);
  const endpoint=new URL(process.env.DEED_DISCOVERY_CATALOG_TEST_DATABASE_URL);
  assert.equal(endpoint.hostname,'127.0.0.1');assert.match(endpoint.pathname,/^\/deed_discovery_catalog_test_[a-f0-9]{12}$/);
  const admin=new pg.Pool({connectionString:endpoint.href});
  const reset='CREATE TABLE IF NOT EXISTS player_reset_migrations (\n    id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()\n  )';
  const owned=name=>{assert.match(name,/^release_phase2_ref_[a-f0-9]{16}$/);return name;};
  async function reference(pool,address,source,{keep=false,currentDeedHomeMigration=false}={}) {
    const name=owned('release_phase2_ref_'+crypto.randomBytes(8).toString('hex'));let client,created=false,retained=false;
    try {
      assert.equal((await pool.query('SELECT nspname FROM pg_namespace WHERE nspname=$1',[name])).rows.length,0);
      await pool.query(`CREATE SCHEMA ${name}`);created=true;
      const url=new URL(address);url.searchParams.set('options',`-c search_path=${name} -c statement_timeout=30000 -c lock_timeout=5000`);
      client=new pg.Client({connectionString:url.href});await client.connect();
      const before=(await client.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];
      const parent=(await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];
      assert.equal(before.schema,name);assert.equal(before.database,parent.database);assert.equal(before.role,parent.role);
      await client.query(source);
      if(currentDeedHomeMigration)await migrateCityHomeStorage(client,{compatibility:'postgres'});
      await client.query(reset);
      if(keep){retained=true;return {client,name};}
      return await readNextLayerReleasePhase2Metadata(client);
    }finally {
      if(!retained){if(client)await client.end();if(created)await pool.query(`DROP SCHEMA ${owned(name)} CASCADE`);}
    }
  }
  try {
    assert.equal((await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0);
    for(const profile of['fresh','phase2','director']) {
      const legacy=profile==='fresh'?'':nextLayerLegacySchema(profile);
      const active=await reference(admin,endpoint.href,legacy+'\n'+sources.current,{keep:true,currentDeedHomeMigration:true});
      try {
        const catalog=await createDeedDiscoveryMigrationCatalog(active.client,endpoint.href,schema,{profile,includeNotNull:profile!=='director',
          compileReference:reference,readMetadata:readNextLayerReleasePhase2Metadata,legacySchema:nextLayerLegacySchema});
        catalog.verifyMetadata(await readNextLayerReleasePhase2Metadata(active.client));
      }finally{await active.client.end();await admin.query(`DROP SCHEMA ${owned(active.name)} CASCADE`);}
    }
    assert.equal((await admin.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'release_phase2_ref_%'")).rows.length,0);
    console.log(`Current Deed native catalog PASS: independently compiled fresh/phase2/director${[...sources.current.matchAll(/^CREATE TABLE IF NOT EXISTS /gm)].length}, frozen${[...sources.predecessor.matchAll(/^CREATE TABLE IF NOT EXISTS /gm)].length} retained, exact replay and every metadata field guarded`);
  }finally{await admin.end();}
}
