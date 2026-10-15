import assert from 'node:assert/strict';
import pg from 'pg';
import { nextLayerMigrationSources, nextLayerMigrationPredecessor, nextLayerNativeHistoricalPredecessor,
  verifyNextLayerNativeBranches, NEXT_LAYER_NATIVE_TABLES, NEXT_LAYER_NATIVE_ADDITIONS, RELEASE_PHASE2_TABLES } from '../tools/next-layer-release-phase2-migration-catalog.js';
import { releasePhase2MigrationSources, releasePhase2MigrationPredecessor, nextFiveNativePredecessor } from '../tools/next-five-release-phase2-migration-catalog.js';
assert(!process.env.DATABASE_URL);
const sources=nextLayerMigrationSources(), old=releasePhase2MigrationSources();
assert.equal(nextLayerMigrationPredecessor(sources.current),sources.predecessor);
assert.equal(nextLayerMigrationPredecessor(sources.current.replaceAll('\n','\r\n')),sources.predecessor);
const historical=nextLayerNativeHistoricalPredecessor(sources.predecessor);
assert.equal(nextLayerNativeHistoricalPredecessor(sources.predecessor.replaceAll('\n','\r\n')),historical);
assert.equal(historical,nextFiveNativePredecessor(old.predecessor));
assert.equal(NEXT_LAYER_NATIVE_TABLES.length,8); assert.equal(NEXT_LAYER_NATIVE_ADDITIONS.added.length,89);
assert.equal(Object.values(NEXT_LAYER_NATIVE_ADDITIONS.notNullColumns).flat().length,78);
let negatives=0;const reject=(fn,arg)=>{assert.throws(()=>fn(arg),e=>e?.code==='ERR_ASSERTION');negatives++;};
for(const [fn,source]of[[nextLayerMigrationPredecessor,sources.current],[nextLayerNativeHistoricalPredecessor,sources.predecessor]]){
  for(const bad of[source+'\n',source+'-- unknown','\uFEFF'+source,source.replace('\n','\r\n'),old.current,old.predecessor,historical])reject(fn,bad);
  for(const table of NEXT_LAYER_NATIVE_TABLES)reject(fn,source.replace('CREATE TABLE IF NOT EXISTS '+table+' (','CREATE TABLE IF NOT EXISTS '+table+'_unknown ('));
}
for(const altered of[sources.current,sources.predecessor]){reject(releasePhase2MigrationPredecessor,altered);reject(nextFiveNativePredecessor,altered);}
console.log('Next-layer exact536/529 source transitions PASS: '+negatives+' refusing controls; old entrypoints remain closed; no native or release clearance');
if(process.argv.includes('--postgres')){
  assert.equal(process.argv.length,3);
  const endpoint=new URL(process.env.NEXT_LAYER_NATIVE_CATALOG_TEST_DATABASE_URL);
  assert(['postgres:','postgresql:'].includes(endpoint.protocol));assert.equal(endpoint.hostname,'127.0.0.1');
  assert.match(endpoint.pathname,/^\/next_layer_native_catalog_test_[a-f0-9]{12}$/);assert(!endpoint.search&&!endpoint.hash);
  const local=['35439','35449'].includes(endpoint.port)&&endpoint.username==='pilot_runner'&&!endpoint.password;
  const ci=endpoint.port==='5432'&&endpoint.username==='postgres'&&endpoint.password==='pgcheck';assert(local||ci);
  const pool=new pg.Pool({connectionString:endpoint.href});
  try{
    const backend=(await pool.query("SELECT current_user AS role,current_setting('server_version') AS version,(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner")).rows[0];
    assert.equal(backend.role,endpoint.username);assert.equal(backend.owner,endpoint.username);assert.match(backend.version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);
    assert.equal((await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0);
    const result=await verifyNextLayerNativeBranches(pool,endpoint.href);
    for(const includeNotNull of[true,false]){
      const main=new Set(RELEASE_PHASE2_TABLES),layer=new Set(NEXT_LAYER_NATIVE_TABLES);
      const rows=result.current.constraints.filter(r=>includeNotNull||r.type!=='n'),premain=result.iv.constraints.filter(r=>includeNotNull||r.type!=='n');
      const projected=rows.filter(r=>!main.has(r.table_name));assert.deepEqual(projected,premain);
      assert.deepEqual(projected.filter(r=>layer.has(r.table_name)),premain.filter(r=>layer.has(r.table_name)),'All eight actual native table constraints remain after main-only projection');
    }
    console.log('Next-layer genuine536/529/487/480 native proof PASS: '+result.causal+' causal controls; all416 structural/434NN pre-main rows retained; no runtime/deployment clearance');
  }finally{await pool.end();}
}
