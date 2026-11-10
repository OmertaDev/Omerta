// Canonical Enterprise current586 entry. Old585 adapter is immutable and separately strict.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { taskPuzzleCatalogSource, verifyTaskPuzzleNativeReferences } from './task-puzzle-native-catalog.js';
import { captureQuestingEnterpriseSource, assertQuestingEnterpriseStable } from './enterprise-native-questing.js';
const root=fileURLToPath(new URL('../',import.meta.url));
async function empty(pool){
  assert.deepEqual((await pool.query("SELECT nspname FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema' ORDER BY nspname")).rows.map(row=>row.nspname),['public']);
  assert.deepEqual((await pool.query("SELECT c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,c.relkind")).rows,[]);
}
export async function verifyTaskPuzzleEnterpriseCatalog(pool,endpoint,raw){
  assert.equal(arguments.length,3);assert.equal(process.execArgv.length,0);assert.equal(process.argv.length,3);assert.equal(process.argv[2],'--postgres');
  assert.equal(path.resolve(process.argv[1]),path.join(root,'test','enterprise-release-phase2-migration-catalog.js'),'Only canonical Enterprise catalog child');
  taskPuzzleCatalogSource(raw);
  const key='ENTERPRISE_NATIVE_CATALOG_TEST_DATABASE_URL';
  for(const name of Object.keys(process.env)){if(/DATABASE_URL$/i.test(name))assert.equal(name,key);else assert(!/^PG|^RC1|^P2_TEST/i.test(name)&&!['NODE_OPTIONS','NODE_PATH','NODE_PG_FORCE_NATIVE','LEGAL_PROFILE_DEFER','GENESIS_AUCTION_MANIFEST_PATH','GENESIS_AUCTION_MANIFEST_SHA256'].includes(name.toUpperCase()));}
  assert.equal(process.env.CHAIN_ENABLED,'off');assert.equal(process.env.RESOURCE_ECONOMY,'off');
  const address=new URL(endpoint);assert.equal(new URL(process.env[key]).href,address.href);assert(['postgres:','postgresql:'].includes(address.protocol)&&address.hostname==='127.0.0.1'&&!address.search&&!address.hash);
  assert.match(address.pathname,/^\/enterprise_native_catalog_test_[a-f0-9]{12}$/);
  assert(['35439','35449'].includes(address.port)&&address.username==='pilot_runner'&&!address.password||address.port==='5432'&&address.username==='postgres'&&address.password==='pgcheck');
  const capture=captureQuestingEnterpriseSource();
  await empty(pool);const current=await verifyTaskPuzzleNativeReferences(pool,endpoint,raw);await empty(pool);
  const historicalSource=execFileSync('git',['--no-replace-objects','show','52c582d7859843e02f45ed5d5c2377c996dd43da:schema.sql'],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:32e6});
  assert.equal(crypto.createHash('sha256').update(historicalSource).digest('hex'),'833373245ddb1ce5a3c9ed386a9b3245d81ddb0bdb51e75d1e5ffee2a7684335');
  const compiler=await import('./commerce-deed-release-phase2-native-catalog.js');
  const historical=await compiler.verifyCommerceEnterpriseSlotBranches(pool,endpoint,historicalSource);await empty(pool);assertQuestingEnterpriseStable(capture);
  return Object.freeze({...current,historical,phase:'ACTUAL_TASK_PUZZLE586_ENTERPRISE_CATALOG'});
}
