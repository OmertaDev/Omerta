// Fresh, explicit loopback qualification databases; no production URL fallback or partial mode.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import pg from 'pg';
export const EQUIPMENT_NATIVE_PROOFS=Object.freeze([
 ['game-item-boundary','GAME_ITEM_BOUNDARY_TEST_DATABASE_URL','game_item_boundary_test_'],
 ['game-item-boundary-adversarial','GAME_ITEM_BOUNDARY_TEST_DATABASE_URL','game_item_boundary_test_'],
 ['game-item-boundary-poison','GAME_ITEM_BOUNDARY_TEST_DATABASE_URL','game_item_boundary_test_'],
 ['equipment-rental-relay','EQUIPMENT_RENTAL_RELAY_TEST_DATABASE_URL','equipment_rental_relay_test_'],
 ['equipmentrentals','EQUIPMENT_RENTAL_TEST_DATABASE_URL','equipment_rental_test_'],
 ['equipmentrentals-api','EQUIPMENT_RENTAL_API_TEST_DATABASE_URL','equipment_rental_api_test_'],
 ['equipmentrentals-integration','EQUIPMENT_RENTAL_INTEGRATION_TEST_DATABASE_URL','equipment_rental_integration_test_'],
 ['equipment-rental-estate-callers','EQUIPMENT_RENTAL_ESTATE_TEST_DATABASE_URL','equipment_rental_estate_test_'],
 ['equipmentmaintenance','EQUIPMENT_MAINTENANCE_TEST_DATABASE_URL','equipment_maintenance_'],
 ['equipmentmaintenance-api','EQUIPMENT_MAINTENANCE_API_TEST_DATABASE_URL','equipment_maintenance_'],
 ['commercialnegotiation','COMMERCIAL_NEGOTIATION_TEST_DATABASE_URL','commercial_negotiation_test_'],
 ['servicesubscriptions','SERVICE_SUBSCRIPTIONS_TEST_DATABASE_URL','service_subscriptions_'],
 ['servicesubscriptions-api','SERVICE_SUBSCRIPTIONS_API_TEST_DATABASE_URL','service_subscriptions_'],
 ['contractauctions','CONTRACT_AUCTION_TEST_DATABASE_URL','contract_auction_test_'],
 ['equipment-economy-contracts','COMMERCIAL_NEGOTIATION_TEST_DATABASE_URL','commercial_negotiation_test_'],
 ['equipment-economy-migration-catalog','EQUIPMENT_MIGRATION_TEST_DATABASE_URL','equipment_migration_test_'],
].map(row=>Object.freeze(row)));
export function equipmentNativeEndpoint(value){
 const u=new URL(value);assert(['postgres:','postgresql:'].includes(u.protocol));assert.equal(u.hostname,'127.0.0.1');
 assert.equal(u.pathname,'/postgres');assert(!u.search&&!u.hash);
 const local=u.port==='35449'&&u.username==='pilot_runner'&&!u.password,ci=u.port==='5432'&&u.username==='postgres'&&u.password==='pgcheck';
 assert(local||ci,'Only the explicit owned local or CI fixture service is writable');return {u,local};
}
async function run(){
 assert.equal(process.argv.length,2,'No partial or tail-only qualification');assert(!process.env.DATABASE_URL,'No ambient database endpoint');
 const {u,local}=equipmentNativeEndpoint(process.env.EQUIPMENT_ECONOMY_NATIVE_ADMIN_DATABASE_URL);
 const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','Qualification requires a clean exact source');
 const root=path.join('output','equipment-economy-native-'+source.slice(0,8)+'-'+crypto.randomBytes(4).toString('hex'));fs.mkdirSync(root,{recursive:true});
 const admin=new pg.Client({connectionString:u.href});await admin.connect();const results=[];
 try{
  const version=(await admin.query('SHOW server_version')).rows[0].server_version;assert.match(version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);
  assert.equal((await admin.query('SELECT current_user')).rows[0].current_user,local?'pilot_runner':'postgres');
  for(const[file,key,prefix]of EQUIPMENT_NATIVE_PROOFS){
   const database=prefix+crypto.randomBytes(6).toString('hex');assert.match(database,/^[a-z0-9_]{1,63}$/);
   await admin.query('CREATE DATABASE '+database);const endpoint=new URL(u.href);endpoint.pathname='/'+database;
   const env={...process.env,[key]:endpoint.href,RESOURCE_ECONOMY:'off'};delete env.DATABASE_URL;
   const hash=crypto.createHash('sha256').update(fs.readFileSync('test/'+file+'.js')).digest('hex');console.log(JSON.stringify({file,sourceSha256:hash,state:'started'}));
   const log=fs.createWriteStream(path.join(root,file+'.log'));let stderr='';
   const status=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['test/'+file+'.js','--postgres'],{env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',data=>log.write(data));child.stderr.on('data',data=>{log.write(data);stderr=(stderr+data).slice(-3000);});child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
   await new Promise(resolve=>log.end(resolve));results.push({file,database,sourceSha256:hash,...status});
   fs.writeFileSync(path.join(root,'results.json'),JSON.stringify({source,version,financialActivation:'off',results},null,2)+'\n');
   if(status.code!==0||status.signal){console.error(stderr);throw new Error(file+' native qualification failed');}
   console.log(JSON.stringify({file,state:'passed'}));
  }
  console.log('Equipment economy native: all16 fresh proofs passed; no partial qualification.');
 }finally{await admin.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await run();
