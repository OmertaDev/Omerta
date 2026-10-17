import {hasFinalServicesCommerceSource,finalServicesOverCommerceSourceBaseline} from '../tools/finalservices-commerce-source-compatibility.js';
const selectFinalServicesCommerceTestSource=(file,input)=>hasFinalServicesCommerceSource(file)?finalServicesOverCommerceSourceBaseline(file,String(input)):input;
import {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from "../tools/commerce-current-enterprise-source-compatibility.js";
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {enterpriseCurrentHistorical6bSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';
import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import pg from 'pg';
import {marketOperationsMigrationSources,marketOperationsMigrationPredecessor,marketOperationsNativeHistoricalPredecessor,
  marketOperationsNativeBranchSources,verifyMarketOperationsNativeBranches,MARKET_OPERATIONS_TABLES,
  MARKET_OPERATIONS_NATIVE_TABLES,MARKET_OPERATIONS_ADDITIONS,MARKET_OPERATIONS_NATIVE_ADDITIONS,RELEASE_PHASE2_TABLES} from '../tools/market-operations-release-phase2-migration-catalog.js';
import {nextLayerMigrationSources,nextLayerMigrationPredecessor,nextLayerNativeHistoricalPredecessor,nextLayerNativeBranchSources,
  NEXT_LAYER_NATIVE_TABLES,NEXT_LAYER_NATIVE_ADDITIONS} from '../tools/next-layer-release-phase2-migration-catalog.js';
import {releasePhase2MigrationPredecessor,nextFiveNativePredecessor} from '../tools/next-five-release-phase2-migration-catalog.js';
assert(!process.env.DATABASE_URL);
const sources=marketOperationsMigrationSources(),prior=nextLayerMigrationSources(),branches=marketOperationsNativeBranchSources(),oldBranches=nextLayerNativeBranchSources();
assert.deepEqual(Object.keys(branches),['current','iv','main','common']);assert.equal(branches.current,sources.current);assert.equal(branches.iv,sources.predecessor);
assert.equal(branches.main,oldBranches.main);assert.equal(branches.common,oldBranches.common);
assert.equal(marketOperationsMigrationPredecessor(sources.current),sources.predecessor);assert.equal(marketOperationsMigrationPredecessor(sources.current.replaceAll('\n','\r\n')),sources.predecessor);
assert(sources.current.startsWith(prior.current));const append=sources.current.slice(prior.current.length);assert.equal(sources.predecessor,prior.predecessor+append);
assert.equal(marketOperationsNativeHistoricalPredecessor(sources.predecessor),nextLayerNativeHistoricalPredecessor(prior.predecessor));
assert.equal(marketOperationsNativeHistoricalPredecessor(sources.predecessor.replaceAll('\n','\r\n')),nextLayerNativeHistoricalPredecessor(prior.predecessor));
assert.deepEqual(MARKET_OPERATIONS_TABLES,['cross_dock_links','cross_dock_requests','production_slot_reservations','production_slot_requests','merchant_return_rights','merchant_return_requests']);
assert.deepEqual(MARKET_OPERATIONS_NATIVE_TABLES,[...NEXT_LAYER_NATIVE_TABLES,...MARKET_OPERATIONS_TABLES]);assert.equal(MARKET_OPERATIONS_NATIVE_TABLES.length,14);
assert.equal(MARKET_OPERATIONS_ADDITIONS.added.length,70);assert.equal(Object.values(MARKET_OPERATIONS_ADDITIONS.notNullColumns).flat().length,66);
assert.deepEqual(MARKET_OPERATIONS_NATIVE_ADDITIONS.added,[...NEXT_LAYER_NATIVE_ADDITIONS.added,...MARKET_OPERATIONS_ADDITIONS.added]);
assert.deepEqual(MARKET_OPERATIONS_NATIVE_ADDITIONS.notNullColumns,{...NEXT_LAYER_NATIVE_ADDITIONS.notNullColumns,...MARKET_OPERATIONS_ADDITIONS.notNullColumns});
assert.equal(MARKET_OPERATIONS_NATIVE_ADDITIONS.added.length,159);assert.equal(Object.values(MARKET_OPERATIONS_NATIVE_ADDITIONS.notNullColumns).flat().length,144);
const raw=enterpriseCurrentHistorical6bSourceBaseline('test/lib/phase2-architecture-upgrade-catalog.json',(hasCommerceCurrentEnterpriseSource('test/lib/phase2-architecture-upgrade-catalog.json')?commerceOverCurrentEnterpriseSourceBaseline('test/lib/phase2-architecture-upgrade-catalog.json',String(selectFinalServicesCommerceTestSource('test/lib/phase2-architecture-upgrade-catalog.json',fs.readFileSync(new URL('./lib/phase2-architecture-upgrade-catalog.json',import.meta.url),'utf8')))):selectFinalServicesCommerceTestSource('test/lib/phase2-architecture-upgrade-catalog.json',fs.readFileSync(new URL('./lib/phase2-architecture-upgrade-catalog.json',import.meta.url),'utf8')))),catalog=JSON.parse(raw);
assert.equal(catalog.added.length,1402);assert.deepEqual(catalog.added.slice(-70),MARKET_OPERATIONS_ADDITIONS.added);
const withoutSix={...catalog,added:catalog.added.slice(0,-70),notNullColumns:Object.fromEntries(Object.entries(catalog.notNullColumns).filter(([table])=>!MARKET_OPERATIONS_TABLES.includes(table)))};
const ancestorBytes=(await import('node:child_process')).execFileSync('git',['show','9376c5a4553bc1b95d3e74f9c7f0d88b794933d6:test/lib/phase2-architecture-upgrade-catalog.json']);
assert.equal(crypto.createHash('sha256').update(ancestorBytes).digest('hex'),'24643ba13f016271634dbbdef3590ee09b6688f844cbc80b7ffacf64da303522');
assert.deepEqual(withoutSix,JSON.parse(ancestorBytes),'Every1332 ancestor row, metadata property and NOT NULL map remains exact');
const expectedCatalog={...JSON.parse(ancestorBytes),added:[...JSON.parse(ancestorBytes).added,...MARKET_OPERATIONS_ADDITIONS.added],notNullColumns:{...JSON.parse(ancestorBytes).notNullColumns,...MARKET_OPERATIONS_ADDITIONS.notNullColumns}};
const verifyCatalog=value=>assert(isDeepStrictEqual(value,expectedCatalog),'Entire1402 catalog includes exact six-table required-column maps and no extra metadata');
verifyCatalog(catalog);
let negatives=0;const reject=(fn,arg)=>{assert.throws(()=>fn(arg),e=>e?.code==='ERR_ASSERTION');negatives++;};
for(const table of MARKET_OPERATIONS_TABLES){for(const mutate of[
  value=>value.added.splice(value.added.findIndex(row=>row.table_name===table),1),
  value=>value.added.find(row=>row.table_name===table).definition+=' altered',
  value=>value.added.push({table_name:table,name:'unreviewed_constraint',definition:'CHECK (true)'}),
  value=>value.notNullColumns[table].push('unreviewed_column')]){const changed=JSON.parse(JSON.stringify(catalog));mutate(changed);reject(verifyCatalog,changed);}}
for(const mutate of[value=>value.added[0].definition+=' altered',value=>value.added.push({table_name:'unreviewed_table',name:'unreviewed_constraint',definition:'CHECK (true)'}),value=>value.unreviewed=true]){const changed=JSON.parse(JSON.stringify(catalog));mutate(changed);reject(verifyCatalog,changed);}
for(const [fn,source]of[[marketOperationsMigrationPredecessor,sources.current],[marketOperationsNativeHistoricalPredecessor,sources.predecessor]]){
  for(const bad of[source+'\n',source+'-- unknown','\uFEFF'+source,source.replace('\n','\r\n'),prior.current,prior.predecessor,branches.main,branches.common])reject(fn,bad);
  for(const table of MARKET_OPERATIONS_NATIVE_TABLES)reject(fn,source.replace('CREATE TABLE IF NOT EXISTS '+table+' (','CREATE TABLE IF NOT EXISTS '+table+'_unreviewed ('));
}
for(const altered of[sources.current,sources.predecessor])for(const fn of[nextLayerMigrationPredecessor,nextLayerNativeHistoricalPredecessor,releasePhase2MigrationPredecessor,nextFiveNativePredecessor])reject(fn,altered);
console.log('Market operations exact542/535/487/480 source identities and whole1332→1402 catalog PASS: '+negatives+' refusing controls; no native/release qualification');
if(process.argv.includes('--postgres')){
  assert.equal(process.argv.length,3);const endpoint=new URL(process.env.MARKET_OPERATIONS_NATIVE_CATALOG_TEST_DATABASE_URL);
  assert(['postgres:','postgresql:'].includes(endpoint.protocol));assert.equal(endpoint.hostname,'127.0.0.1');assert.match(endpoint.pathname,/^\/market_operations_native_catalog_test_[a-f0-9]{12}$/);assert(!endpoint.search&&!endpoint.hash);
  const local=['35439','35449'].includes(endpoint.port)&&endpoint.username==='pilot_runner'&&!endpoint.password;
  const ci=endpoint.port==='5432'&&endpoint.username==='postgres'&&endpoint.password==='pgcheck';assert(local||ci);
  const pool=new pg.Pool({connectionString:endpoint.href});try{
    const backend=(await pool.query("SELECT current_user AS role,current_setting('server_version') AS version,(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner")).rows[0];
    assert.equal(backend.role,endpoint.username);assert.equal(backend.owner,endpoint.username);assert.match(backend.version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);
    assert.equal((await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0);
    const result=await verifyMarketOperationsNativeBranches(pool,endpoint.href);
    for(const includeNotNull of[true,false]){
      const main=new Set(RELEASE_PHASE2_TABLES),retained=new Set(MARKET_OPERATIONS_NATIVE_TABLES),rows=result.current.constraints.filter(r=>includeNotNull||r.type!=='n'),premain=result.iv.constraints.filter(r=>includeNotNull||r.type!=='n');
      const projected=rows.filter(r=>!main.has(r.table_name));assert.deepEqual(projected,premain);
      assert.deepEqual(projected.filter(r=>retained.has(r.table_name)),premain.filter(r=>retained.has(r.table_name)),'All fourteen actual native addition tables remain after main-only projection');
    }
    console.log('Market operations genuine542/535/487/480 independent native proof PASS: '+result.causal+' causal controls; complete486 structural/500NN pre-main rows retained; no gameplay/deployment clearance');
  }finally{await pool.end();}
}
