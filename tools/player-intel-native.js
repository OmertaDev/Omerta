// Run the unchanged current-source PlayerIntel proofs in owned native schemas,
// using the existing disposable City CI fixture. There is no pg-mem fallback.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { cityGameplayMigrationEndpoint } from '../test/lib/city-gameplay-migration-catalog.js';

export const PLAYER_INTEL_NATIVE_PROOFS = Object.freeze([
  'test/player-intel.js', 'test/player-intel-projections.js', 'test/player-intel-gates.js',
]);
const runner = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(runner),'..');
const ownedName = name => { assert.match(name,/^player_intel_native_[0-9a-f]{32}$/); return name; };
const options = name => `-c search_path=${ownedName(name)} -c statement_timeout=30000 -c lock_timeout=8000 -c idle_in_transaction_session_timeout=30000`;
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
async function provenance(client,name) {
  const row = (await client.query(`SELECT current_schema() AS schema,current_database() AS database,current_user AS role,
    version() AS version,current_setting('server_version_num') AS server_version_num,
    current_setting('statement_timeout') AS statement_timeout,current_setting('lock_timeout') AS lock_timeout,
    current_setting('idle_in_transaction_session_timeout') AS idle_timeout`)).rows[0];
  assert.equal(row.schema,name); assert.match(row.version,/^PostgreSQL /);
  assert.equal(row.statement_timeout,'30s'); assert.equal(row.lock_timeout,'8s'); assert.equal(row.idle_timeout,'30s');
  return row;
}
async function child(file) {
  assert.equal(process.argv.length,4); assert(PLAYER_INTEL_NATIVE_PROOFS.includes(file),'Only a complete declared PlayerIntel proof may run');
  const name = ownedName(process.env.PLAYER_INTEL_NATIVE_SCHEMA);
  const base = cityGameplayMigrationEndpoint(process.env.CITY_HOMES_TEST_DATABASE_URL);
  const expected = new URL(base); expected.searchParams.set('options',options(name));
  assert.equal(process.env.DATABASE_URL === expected.toString(),true,'Native proof must use the exact parent-issued schema URL');
  const client = new pg.Client({ connectionString: expected.toString() });
  await client.connect();
  try {
    const row = await provenance(client,name);
    assert.equal(row.database,base.pathname.slice(1));
    const owner = (await client.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1',[name])).rows[0];
    assert.equal(owner?.mine,true,'Native child uses only its owned schema');
    assert.equal((await client.query('SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1',[name])).rows.length,0,
      'Every PlayerIntel proof starts in a fresh empty schema');
    console.log(JSON.stringify({ proof:file,state:'native-ready',postgresVersion:row.version,serverVersionNum:row.server_version_num }));
  } finally { await client.end(); }
  await import(pathToFileURL(path.join(root,file)).href);
  const written = new pg.Client({ connectionString: expected.toString() });
  await written.connect();
  try {
    await provenance(written,name);
    assert(Number((await written.query('SELECT COUNT(*) AS count FROM player_intel')).rows[0].count) > 0,
      'The completed proof must persist observations in its real owned PostgreSQL schema');
  } finally { await written.end(); }
}
async function run() {
  assert.equal(process.argv.length,2,'This native qualification runner has no partial/tail-only mode');
  const endpoint = cityGameplayMigrationEndpoint(process.env.CITY_HOMES_TEST_DATABASE_URL);
  const adminUrl = new URL(endpoint); adminUrl.searchParams.set('options','-c search_path=pg_catalog -c statement_timeout=30000 -c lock_timeout=8000');
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const server = (await admin.query("SELECT version() AS version,current_setting('server_version_num') AS server_version_num")).rows[0];
    assert.match(server.version,/^PostgreSQL /);
    for(const file of PLAYER_INTEL_NATIVE_PROOFS) {
      const name = ownedName('player_intel_native_'+crypto.randomUUID().replaceAll('-',''));
      const receipt = { proof:file,sourceSha256:hash(file),playerIntelSourceSha256:hash('src/playerintel.js'),schemaSourceSha256:hash('schema.sql'),
        postgresVersion:server.version,serverVersionNum:server.server_version_num };
      let created = false;
      const start = Date.now();
      try {
        assert.equal((await admin.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[name])).rows.length,0,'Generated native schema must not pre-exist');
        await admin.query(`CREATE SCHEMA "${name}"`); created = true;
        const childUrl = new URL(endpoint); childUrl.searchParams.set('options',options(name));
        console.log(JSON.stringify({ ...receipt,state:'started' }));
        const status = await new Promise((resolve,reject) => {
          const proof = spawn(process.execPath,[runner,'--child',file],{ cwd:root,stdio:'inherit',windowsHide:true,env:{ ...process.env,
            CITY_HOMES_TEST_DATABASE_URL:endpoint.toString(),DATABASE_URL:childUrl.toString(),PLAYER_INTEL_NATIVE_SCHEMA:name,
            JWT_SECRET:'ci-jwt-secret-not-a-real-one',MOD_KEY:'ci-mod-key-long-enough-to-pass-preflight',
            MARKET_SEED:'ciMarketSeed7Qx2mVb9PwLn4RtY6hJc',SOCIAL_VERIFY_MODE:'off',POPULATION_OFF:'on',INVARIANT_WEBHOOK_URL:'' } });
          proof.once('error',reject); proof.once('exit',(code,signal) => resolve({ code,signal }));
        });
        assert.equal(status.signal,null,file+' interrupted'); assert.equal(status.code,0,file+' failed');
      } finally {
        if(created) {
          const owner = (await admin.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1',[name])).rows[0];
          assert.equal(owner?.mine,true,'Drop only the positively created native schema owned by this connection');
          await admin.query(`DROP SCHEMA "${ownedName(name)}" CASCADE`);
        }
      }
      console.log(JSON.stringify({ ...receipt,state:'passed',elapsedMs:Date.now()-start }));
    }
    console.log('PlayerIntel native: all three current-source proofs passed with real PostgreSQL; no partial qualification');
  } finally { await admin.end(); }
}
if(process.argv[1] && path.resolve(process.argv[1]) === runner) {
  if(process.argv[2] === '--child') await child(process.argv[3]); else await run();
}
