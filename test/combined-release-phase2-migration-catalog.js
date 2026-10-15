import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { releasePhase2MigrationPredecessor, releasePhase2MigrationSources,
  verifyCombinedNativeBranches, RELEASE_PHASE2_TABLES } from '../tools/combined-release-phase2-migration-catalog.js';
assert(!process.env.DATABASE_URL, 'No ambient native endpoint');
const sources = releasePhase2MigrationSources();
assert.equal(releasePhase2MigrationPredecessor(sources.current), sources.predecessor);
assert.equal(releasePhase2MigrationPredecessor(sources.current.replaceAll('\n','\r\n')), sources.predecessor);
for (const invalid of [sources.predecessor, sources.current+'\n-- unknown', sources.current.replace('payment_receipts','unknown_receipts'),
  sources.current.replace('\n','\r\n'), sources.current.replace('CREATE TABLE IF NOT EXISTS payment_receipts','CREATE TABLE IF NOT EXISTS unknown_receipts')])
  assert.throws(()=>releasePhase2MigrationPredecessor(invalid), error=>error?.code==='ERR_ASSERTION');
console.log('Combined exact LF/CRLF source and five source drift/refusal controls PASS');
if (process.argv.includes('--postgres')) {
  const endpoint = new URL(process.env.COMBINED_NATIVE_CATALOG_TEST_DATABASE_URL);
  assert(['postgres:','postgresql:'].includes(endpoint.protocol)); assert.equal(endpoint.hostname,'127.0.0.1');
  assert.match(endpoint.pathname,/^\/combined_native_catalog_test_[a-f0-9]{12}$/); assert(!endpoint.search&&!endpoint.hash);
  const local=['35439','35449'].includes(endpoint.port)&&endpoint.username==='pilot_runner'&&!endpoint.password;
  const ci=endpoint.port==='5432'&&endpoint.username==='postgres'&&endpoint.password==='pgcheck'; assert(local||ci);
  const pool=new pg.Pool({connectionString:endpoint.href});
  try {
    const settings=(await pool.query("SELECT current_user AS role,current_setting('server_version') AS version")).rows[0];
    assert.equal(settings.role,endpoint.username); assert.match(settings.version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);
    assert.equal((await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0);
    const result=await verifyCombinedNativeBranches(pool,endpoint.href);
    for(const includeNotNull of [true,false]) {
      const rows=result.current.constraints.filter(row=>includeNotNull||row.type!=='n');
      const main=new Set(RELEASE_PHASE2_TABLES);
      const projected=rows.filter(row=>!main.has(row.table_name));
      assert.deepEqual(projected,result.iv.constraints.filter(row=>includeNotNull||row.type!=='n'));
    }
    console.log(`Combined native branch proof PASS: ${result.causal} causal controls; only seven main tables projected, all IV132/114 rows retained`);
  }finally{await pool.end();}
}
