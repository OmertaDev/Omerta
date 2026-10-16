import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {execFileSync} from 'node:child_process';

assert.equal(process.execArgv.length,0,'Only the bare Node test entrypoint is admitted');
const native=process.argv.length===3&&process.argv[2]==='--postgres';
assert(process.argv.length===2||native,'Only the complete pure test or literal --postgres mode is admitted');
const endpointKey='ENTERPRISE_NATIVE_CATALOG_TEST_DATABASE_URL';
for(const key of Object.keys(process.env)){
  const upper=key.toUpperCase();
  if(/DATABASE_URL$/i.test(key))assert(native&&key===endpointKey,'No ambient or aliased database target: '+key);
  else assert(!/^PG/i.test(key)&&!['NODE_OPTIONS','NODE_PATH','NODE_PG_FORCE_NATIVE','LEGAL_PROFILE_DEFER'].includes(upper),'No ambient backend, preload, search-path or legal override: '+key);
}
let endpoint,local=false;
if(native){
  assert(Object.hasOwn(process.env,endpointKey),'The explicit enterprise native endpoint is required');
  endpoint=new URL(process.env[endpointKey]);
  assert(['postgres:','postgresql:'].includes(endpoint.protocol));assert.equal(endpoint.hostname,'127.0.0.1');
  assert.match(endpoint.pathname,/^\/enterprise_native_catalog_test_[a-f0-9]{12}$/);assert(!endpoint.search&&!endpoint.hash);
  local=['35439','35449'].includes(endpoint.port)&&endpoint.username==='pilot_runner'&&!endpoint.password;
  const ci=endpoint.port==='5432'&&endpoint.username==='postgres'&&endpoint.password==='pgcheck';assert(local||ci,'Only the strict owned local or canonical CI target is admitted');
  assert.equal(process.env.CHAIN_ENABLED,'off');assert.equal(process.env.RESOURCE_ECONOMY,'off');
}

const lf=text=>text.replaceAll('\r\n','\n');
const uniform=text=>{const normalized=lf(text);return !normalized.includes('\r')&&(text===normalized||text===normalized.replaceAll('\n','\r\n'));};
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const frozenText=(relative,expected)=>{const raw=fs.readFileSync(new URL(relative,import.meta.url),'utf8');assert(uniform(raw),'Only exact LF or uniform checkout CRLF');const text=lf(raw);assert.equal(hash(text),expected,'Complete reviewed source remains exact: '+relative);return text;};
frozenText('../tools/enterprise-release-phase2-migration-catalog.js','fc35f2b8770f3c7bd77347478c55eb944935fed019d40a43b101c70e5bc82570');
frozenText('../tools/market-operations-release-phase2-migration-catalog.js','689d63b4273296c247fb130566a96d9c1beb049c8b0bde3169b988f66074acf1');
frozenText('../tools/enterprise-deed-release-phase2-migration-catalog.js','8ed9ee0e08e9bbbc25bc921ea5ec96e4de495121454b0e21857a7d318f31a49e');
// All endpoint/environment/preload admission above precedes these helper imports, including their pg dependency.
const historicalEnterprise=await import('../tools/enterprise-release-phase2-migration-catalog.js');
const enterprise=await import('../tools/enterprise-deed-release-phase2-migration-catalog.js');
const prior=await import('../tools/market-operations-release-phase2-migration-catalog.js');
const nextLayer=await import('../tools/next-layer-release-phase2-migration-catalog.js');
const nextFive=await import('../tools/next-five-release-phase2-migration-catalog.js');
const {enterpriseMigrationSources,enterpriseMigrationPredecessor,enterpriseNativeHistoricalPredecessor,
  enterpriseNativeBranchSources,verifyEnterpriseNativeBranches,ENTERPRISE_TABLES,ENTERPRISE_NATIVE_TABLES,
  ENTERPRISE_ADDITIONS,ENTERPRISE_NATIVE_ADDITIONS,ENTERPRISE_RELEASE_PHASE2_TABLES}=enterprise;
const sources=enterpriseMigrationSources(),old=prior.marketOperationsMigrationSources(),branches=enterpriseNativeBranchSources(),oldBranches=prior.marketOperationsNativeBranchSources();
assert.deepEqual(Object.keys(branches),['current','iv','main','common']);assert.equal(branches.current,sources.current);assert.equal(branches.iv,sources.predecessor);
assert.equal(branches.main,oldBranches.main);assert.equal(branches.common,oldBranches.common);
for(const[name,pin]of Object.entries({current:'50293aebc2fb963c46696869e4770232b4508972820cd1e709918b1df112e90a',iv:'14f01ac9e4f69cf97ab40787f490fb35e9933cc9486e807e45ce3ee1197a063b',main:'29b33ee417443a32b5c3a8b73dc5d7f27b518ed66f746e343da530c1768b9d42',common:'9eead996764ec9b0a7211cb28eefb3588e1f2e100d28cd28e05a39f340e558dd'}))assert.equal(hash(branches[name]),pin);
assert.equal(hash(old.current),'d8016c8f0ccfe0caa29184a0df2d25d46e5a2597d143f33ac167382832418dc9');
assert.equal(hash(old.predecessor),'bf677d757e3d9273f6d5406e4c3cb137e4e7ba87988661c271e67fd7232224d7');
assert(sources.current.startsWith(old.current));const append=sources.current.slice(old.current.length);
assert.equal(Buffer.byteLength(append),6522);assert.equal(append.split('\n').length-1,111);assert.equal(hash(append),'a3ac96b019b224d46e8dbf0de936e7d11407934f58e63b1e8e32e7896adf3209');assert(!/\bALTER\s+TABLE\b/i.test(append));
assert.equal(sources.predecessor,old.predecessor+append);
for(const input of[sources.current,sources.current.replaceAll('\n','\r\n')])assert.equal(enterpriseMigrationPredecessor(input),sources.predecessor);
for(const input of[sources.predecessor,sources.predecessor.replaceAll('\n','\r\n')])assert.equal(enterpriseNativeHistoricalPredecessor(input),prior.marketOperationsNativeHistoricalPredecessor(old.predecessor));
const actualSchema=fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8');assert(uniform(actualSchema));const currentDeed=enterprise.enterpriseCurrentDeedSources(actualSchema);assert.equal(currentDeed.predecessor,sources.current);assert.throws(()=>historicalEnterprise.enterpriseMigrationPredecessor(actualSchema),error=>error?.code==='ERR_ASSERTION','Raw555 never gains historical551 admission');
const currentDeedBranches=enterprise.enterpriseCurrentDeedNativeSources();assert.equal(lf(actualSchema),currentDeedBranches.current);assert.equal(hash(currentDeedBranches.premain),'5cba5f46e5b29c9a4e46e8172ef4d025db388f468f0d3789a0ae359c4812b480');
assert.deepEqual(ENTERPRISE_TABLES,['workshop_floorplans','workshop_floor_requests','manufacturing_licenses','manufacturing_license_requests','mobile_shops','mobile_shop_requests','business_relocation_plans','business_relocation_requests','equipment_recovery_requests']);
assert.deepEqual(ENTERPRISE_NATIVE_TABLES,[...prior.MARKET_OPERATIONS_NATIVE_TABLES,...ENTERPRISE_TABLES]);assert.equal(ENTERPRISE_NATIVE_TABLES.length,23);
assert.equal(ENTERPRISE_ADDITIONS.added.length,73);assert.equal(Object.keys(ENTERPRISE_ADDITIONS.notNullColumns).length,9);assert.equal(Object.values(ENTERPRISE_ADDITIONS.notNullColumns).flat().length,73);
assert.deepEqual(ENTERPRISE_NATIVE_ADDITIONS.added,[...prior.MARKET_OPERATIONS_NATIVE_ADDITIONS.added,...ENTERPRISE_ADDITIONS.added]);
assert.deepEqual(ENTERPRISE_NATIVE_ADDITIONS.notNullColumns,{...prior.MARKET_OPERATIONS_NATIVE_ADDITIONS.notNullColumns,...ENTERPRISE_ADDITIONS.notNullColumns});
assert.equal(ENTERPRISE_NATIVE_ADDITIONS.added.length,232);assert.equal(Object.values(ENTERPRISE_NATIVE_ADDITIONS.notNullColumns).flat().length,217);
const raw=frozenText('./lib/phase2-architecture-upgrade-catalog.json','f45eb6f97c65ee00d3ad97e0c3a50756acbde77558abd1a86220bf9780006a65'),catalog=JSON.parse(raw);
const oldBytes=execFileSync('git',['show','d6b8cd00841e4be491bb3d9b5112ac2cd64db5aa:test/lib/phase2-architecture-upgrade-catalog.json'],{maxBuffer:8e6});assert.equal(hash(oldBytes),'e36821d46a0ba1b63b1e2f19b4522bb399bf416a9dbda38c73b4389234f51af9');const oldCatalog=JSON.parse(oldBytes);
assert.equal(oldCatalog.added.length,1402);assert.equal(Object.keys(oldCatalog.notNullColumns).length,189);assert.equal(oldCatalog.removed.length,3);
assert.deepEqual(Object.keys(catalog),Object.keys(oldCatalog));assert.deepEqual(catalog.added.slice(0,1402),oldCatalog.added);assert.deepEqual(catalog.removed,oldCatalog.removed);assert.equal(catalog.note,oldCatalog.note);
for(const[table,columns]of Object.entries(oldCatalog.notNullColumns))assert.deepEqual(catalog.notNullColumns[table],columns);
const expectedCatalog={...oldCatalog,added:[...oldCatalog.added,...ENTERPRISE_ADDITIONS.added],notNullColumns:{...oldCatalog.notNullColumns,...ENTERPRISE_ADDITIONS.notNullColumns}};
const verifyCatalog=value=>assert(isDeepStrictEqual(value,expectedCatalog),'Complete1475 catalog preserves all original metadata and exact enterprise rows/maps');verifyCatalog(catalog);assert.equal(catalog.added.length,1475);assert.equal(Object.keys(catalog.notNullColumns).length,198);
const withoutNine={...catalog,added:catalog.added.slice(0,-73),notNullColumns:Object.fromEntries(Object.entries(catalog.notNullColumns).filter(([table])=>!ENTERPRISE_TABLES.includes(table)))};assert.deepEqual(withoutNine,oldCatalog);
let negatives=0;const reject=(fn,arg)=>{assert.throws(()=>fn(arg),error=>error?.code==='ERR_ASSERTION');negatives++;};
for(const table of ENTERPRISE_TABLES)for(const mutate of[
  value=>value.added.splice(value.added.findIndex(row=>row.table_name===table),1),
  value=>value.added.find(row=>row.table_name===table).definition+=' altered',
  value=>value.added.find(row=>row.table_name===table).name+='__unknown',
  value=>value.added.push({...value.added.find(row=>row.table_name===table)}),
  value=>{delete value.notNullColumns[table];},
  value=>value.notNullColumns[table].push('unreviewed_column'),
  value=>value.notNullColumns[table].splice(0,1)]){const copy=structuredClone(catalog);mutate(copy);reject(verifyCatalog,copy);}
for(const mutate of[value=>value.added[0].definition+=' altered',value=>value.added.push({table_name:'unknown',name:'unknown',definition:'CHECK (true)'}),value=>value.removed.push({table_name:'unknown',name:'unknown'}),value=>value.notNullColumns.unknown=['unknown'],value=>{value.unknown=true;}]){const copy=structuredClone(catalog);mutate(copy);reject(verifyCatalog,copy);}
for(const[fn,source]of[[enterpriseMigrationPredecessor,sources.current],[enterpriseNativeHistoricalPredecessor,sources.predecessor]]){
  for(const bad of[source+'\n',source+'-- unknown','\ufeff'+source,source.replace('\n','\r\n'),old.current,old.predecessor,branches.main,branches.common])reject(fn,bad);
  for(const table of ENTERPRISE_TABLES){const needle='CREATE TABLE IF NOT EXISTS '+table+' (';assert(source.includes(needle));const changed=source.replace(needle,'CREATE TABLE IF NOT EXISTS '+table+'__unknown (');assert.notEqual(changed,source);reject(fn,changed);}
}
for(const source of[sources.current,sources.predecessor])for(const fn of[prior.marketOperationsMigrationPredecessor,prior.marketOperationsNativeHistoricalPredecessor,nextLayer.nextLayerMigrationPredecessor,nextLayer.nextLayerNativeHistoricalPredecessor,nextFive.releasePhase2MigrationPredecessor,nextFive.nextFiveNativePredecessor])reject(fn,source);
console.log('Enterprise exact551/544/487/480 and complete1402→1475 catalog source proof PASS: '+negatives+' refusing controls; retained23=232 structural/217 required. This pure phase grants no native, migration or release clearance.');

if(native){
  const {default:pg}=await import('pg');
  const pool=new pg.Pool({connectionString:endpoint.href,max:1});
  try{
    const backend=(await pool.query("SELECT current_user AS role,current_database() AS database,current_setting('server_version') AS version,current_setting('data_directory') AS directory,(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner")).rows[0];
    assert.equal(backend.role,endpoint.username);assert.equal(backend.owner,endpoint.username);assert.equal('/'+backend.database,endpoint.pathname);assert.match(backend.version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);
    if(local){const directories={'35439':'c:/users/jorge/appdata/local/temp/omerta-economy-oct15-pg184','35449':'c:/users/jorge/appdata/local/temp/omerta-employment-pg184-proof'};assert.equal(backend.directory.replaceAll('\\','/').toLowerCase(),directories[endpoint.port]);}else assert.equal(typeof backend.directory,'string');
    const empty=async()=>{
      assert.deepEqual((await pool.query("SELECT nspname FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema' ORDER BY nspname")).rows.map(row=>row.nspname),['public'],'A fresh owned database has no unknown user namespaces');
      assert.deepEqual((await pool.query("SELECT c.relname AS name,c.relkind AS kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,c.relkind")).rows,[],'Fresh public namespace includes no tables, views, indexes or sequences');
    };
    await empty();
    const result=await verifyEnterpriseNativeBranches(pool,endpoint.href);
    const frozen=value=>{if(value&&typeof value==='object'){assert(Object.isFrozen(value),'Every exposed expected metadata object/array is frozen');Object.values(value).forEach(frozen);}};
    for(const name of['current','iv','main','common'])frozen(result[name]);
    for(const catalog of[result.deedCurrent,result.deedPremain]){frozen(catalog.reference);frozen(catalog.baselineReference);catalog.verifyMetadata(catalog.reference);for(const field of['relations','columns','constraints','indexes']){const tableOf=row=>field==='relations'?row.name:row.table_name;assert.deepEqual(catalog.reference[field].filter(row=>ENTERPRISE_TABLES.includes(tableOf(row))),catalog.baselineReference[field].filter(row=>ENTERPRISE_TABLES.includes(tableOf(row))),'All9 Enterprise complete '+field+' retained through actual Deed delta');}}
    result.verify(result.deedCurrent.reference);

    const main=new Set(ENTERPRISE_RELEASE_PHASE2_TABLES),retained=new Set(ENTERPRISE_NATIVE_TABLES),sorted=rows=>rows.map(row=>JSON.stringify(row)).sort(),same=(a,b,message)=>assert.deepEqual(sorted(a),sorted(b),message);
    for(const table of ENTERPRISE_NATIVE_TABLES)same(result.current.columns.filter(row=>row.table_name===table&&row.not_null).map(row=>row.column_name),ENTERPRISE_NATIVE_ADDITIONS.notNullColumns[table],'All217 original/new required columns remain exact before projection');
    for(const includeNotNull of[true,false]){
      const rows=result.current.constraints.filter(row=>includeNotNull||row.type!=='n'),premain=result.iv.constraints.filter(row=>includeNotNull||row.type!=='n');
      const retainedRows=rows.filter(row=>retained.has(row.table_name));same(retainedRows,premain.filter(row=>retained.has(row.table_name)),'All23 complete native retained tables match before main-only projection');
      const structural=retainedRows.filter(row=>row.type!=='n').map(({table_name,name,definition})=>({table_name,name,definition}));same(structural,ENTERPRISE_NATIVE_ADDITIONS.added,'All232 actual retained structural constraints equal independent constants');
      assert.equal(retainedRows.length,includeNotNull&&/^18\.4\b/.test(backend.version)?449:232);
      const projected=rows.filter(row=>!main.has(row.table_name));same(projected,premain,'Only the seven verified C2 table constraints are projected');same(projected.filter(row=>retained.has(row.table_name)),retainedRows,'No retained enterprise/market table disappears');
    }
    await empty();
    console.log('Enterprise genuine551/544/487/480 native branch/reference proof PASS on '+backend.version+': '+result.causal+' metadata controls; all23 retained tables and all4 frozen references verified. Populated factory upgrades,15/30 ordinals and35 transactional DDL cases require separate canonical caller proofs.');
  }finally{await pool.end();}
}
