// Fresh, explicit loopback qualification databases; no production URL fallback or partial mode.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import pg from 'pg';
export const ATOMIC_BARTER_NATIVE_PROOFS=Object.freeze([
 ['atomicbarter','ATOMIC_BARTER_TEST_DATABASE_URL','atomic_barter_test_'],
 ['atomicbarter-integration','CONSIGNMENT_API_TEST_DATABASE_URL','consignment_api_test_'],
].map(row=>Object.freeze(row)));
import { equipmentNativeEndpoint } from './equipment-economy-native.js';

async function run(){
 assert.equal(process.argv.length,2,'No partial or tail-only qualification');assert(!process.env.DATABASE_URL,'No ambient database endpoint');
 const {u,local}=equipmentNativeEndpoint(process.env.ATOMIC_BARTER_NATIVE_ADMIN_DATABASE_URL);
 const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','Qualification requires a clean exact source');
 const root=path.join('output','atomic-barter-native-'+source.slice(0,8)+'-'+crypto.randomBytes(4).toString('hex'));fs.mkdirSync(root,{recursive:true});
 const admin=new pg.Client({connectionString:u.href});await admin.connect();const results=[];
 try{
  const version=(await admin.query('SHOW server_version')).rows[0].server_version;assert.match(version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);
  assert.equal((await admin.query('SELECT current_user')).rows[0].current_user,local?'pilot_runner':'postgres');
  for(const[file,key,prefix]of ATOMIC_BARTER_NATIVE_PROOFS){
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
  console.log('Atomic barter native: both2 fresh proofs passed; no partial qualification.');
 }finally{await admin.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await run();
