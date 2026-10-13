// Fresh, explicit loopback qualification databases; no production URL fallback or partial mode.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import pg from 'pg';
export const AUTONOMY_NATIVE_PROOFS=Object.freeze([
 ["company-late-five-integration","COMPANY_LATE_FIVE_TEST_DATABASE_URL","company_late_five_test_"],
 [
  "economicintelligence",
  "ECONOMIC_INTELLIGENCE_TEST_DATABASE_URL",
  "economic_intelligence_test_"
 ],
 [
  "agentoperatingmemory",
  "AGENT_OPERATING_MEMORY_TEST_DATABASE_URL",
  "agent_operating_memory_test_"
 ],
 [
  "managementteams",
  "MANAGEMENT_TEAM_TEST_DATABASE_URL",
  "management_team_test_"
 ],
 [
  "managementteams-retry-integration",
  "MANAGEMENT_TEAM_RETRY_TEST_DATABASE_URL",
  "management_team_retry_test_"
 ],
 [
  "strategylaboratories",
  "STRATEGY_LABORATORY_TEST_DATABASE_URL",
  "strategy_laboratory_test_"
 ],
 [
  "strategylaboratories-integration",
  "STRATEGY_LABORATORY_INTEGRATION_TEST_DATABASE_URL",
  "strategy_laboratory_integration_test_"
 ],
 [
  "fundedexternalwork",
  "FUNDED_EXTERNAL_WORK_TEST_DATABASE_URL",
  "funded_external_work_test_"
 ],
 [
  "company-autonomy-contracts",
  "ECONOMIC_INTELLIGENCE_TEST_DATABASE_URL",
  "economic_intelligence_test_"
 ],
 [
  "company-autonomy-contracts",
  "STRATEGY_LABORATORY_INTEGRATION_TEST_DATABASE_URL",
  "strategy_laboratory_integration_test_",
  "--laboratories"
 ]
].map(row=>Object.freeze(row)));
import { equipmentNativeEndpoint } from './equipment-economy-native.js';
export const autonomyNativeEndpoint=equipmentNativeEndpoint;

async function run(){
 assert.equal(process.argv.length,2,'No partial or tail-only qualification');assert(!process.env.DATABASE_URL,'No ambient database endpoint');
 const {u,local}=equipmentNativeEndpoint(process.env.COMPANY_AUTONOMY_NATIVE_ADMIN_DATABASE_URL);
 const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','Qualification requires a clean exact source');
 const root=path.join('output','company-autonomy-native-'+source.slice(0,8)+'-'+crypto.randomBytes(4).toString('hex'));fs.mkdirSync(root,{recursive:true});
 const admin=new pg.Client({connectionString:u.href});await admin.connect();const results=[];
 try{
  const version=(await admin.query('SHOW server_version')).rows[0].server_version;assert.match(version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);
  assert.equal((await admin.query('SELECT current_user')).rows[0].current_user,local?'pilot_runner':'postgres');
  for(const[file,key,prefix,mode]of AUTONOMY_NATIVE_PROOFS){
   const database=prefix+crypto.randomBytes(6).toString('hex');assert.match(database,/^[a-z0-9_]{1,63}$/);
   await admin.query('CREATE DATABASE '+database);const endpoint=new URL(u.href);endpoint.pathname='/'+database;
   const env={...process.env,RESOURCE_ECONOMY:'off'};for(const name of Object.keys(env))if(name==='DATABASE_URL'||name.endsWith('_TEST_DATABASE_URL'))delete env[name];env[key]=endpoint.href;
   const hash=crypto.createHash('sha256').update(fs.readFileSync('test/'+file+'.js')).digest('hex');console.log(JSON.stringify({file,sourceSha256:hash,state:'started'}));
   const proofId=file+(mode?'-laboratories':'');const logPath=path.join(root,proofId+'.log');const log=fs.createWriteStream(logPath);let stderr='';
   const status=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['test/'+file+'.js','--postgres',...(mode?[mode]:[])],{env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',data=>log.write(data));child.stderr.on('data',data=>{log.write(data);stderr=(stderr+data).slice(-3000);});child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
   await new Promise(resolve=>log.end(resolve));results.push({file,mode:mode??null,database,sourceSha256:hash,logSha256:crypto.createHash('sha256').update(fs.readFileSync(logPath)).digest('hex'),...status});
   fs.writeFileSync(path.join(root,'results.json'),JSON.stringify({source,version,financialActivation:'off',results},null,2)+'\n');
   if(status.code!==0||status.signal){console.error(stderr);throw new Error(file+' native qualification failed');}
   console.log(JSON.stringify({file,state:'passed'}));
  }
  console.log('Company autonomy native: all10 fresh proofs passed; no partial qualification.');
 }finally{await admin.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await run();
