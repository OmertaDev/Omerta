import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {finalservicesCurrentRoot as ROOT,finalservicesCurrentParentArguments,finalservicesCurrentEndpoint,assertFinalservicesCurrentBackend,verifyFinalservicesCurrentSource,verifyFinalservicesRawSource,finalservicesN24Projection,refreshFinalservicesRootBinding,finalservicesBindingReceipt,assertFinalservicesExecutionCapture,finalservicesHostedBackendVersion} from './finalservices-current-native-guard.js';
import {FINAL_SERVICES_CURRENT_CASES,FINAL_SERVICES_CURRENT_LEGAL,FINAL_SERVICES_CURRENT_BUDGET} from './finalservices-current-native-data.js';

const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export const FINAL_SERVICES_ALL_CLIENT_SQL="SELECT pid,datname,usename,state FROM pg_stat_activity WHERE (backend_type='client backend' OR backend_type IS NULL) AND pid<>pg_backend_pid() ORDER BY datname,pid";
export async function finalservicesAllClientsZero(client){const rows=(await client.query(FINAL_SERVICES_ALL_CLIENT_SQL)).rows;assert.deepEqual(rows,[],'ALL other client backends, including postgres/null database');return rows;}
export function finalservicesNormalChild(row){return row.closed===true&&row.exitObserved===true&&row.logClosed===true&&row.exitCode===0&&row.code===0&&row.exitSignal===null&&row.signal===null&&row.error===null&&row.deadlineFired===false&&row.sourceBefore===true&&row.sourceAfter===true;}
export function finalservicesCanRelease(report,spec,profiles,failure){
 const expected=spec.profile==='ci'?['ci']:[35439,35449],final=report.closures.filter(row=>row.stage==='final');
 return failure===null&&report.failure===undefined&&report.sourceError===undefined&&report.outerDeadlineFired===false&&report.finalSourceVerified===true&&report.finalN24ProjectionVerified===true&&
  spec.cases.length===31&&report.expectedCases===31&&report.payloads.length===31&&report.allocatedDatabases.length===31&&
  JSON.stringify(profiles)===JSON.stringify(expected)&&report.payloads.every((p,i)=>{
   const item=spec.cases[i],profile=spec.profile==='ci'?'ci':item.preferredLocalPort,a=report.allocatedDatabases[i];
   return finalservicesNormalChild(p)&&p.id===item.id&&p.file===item.file&&JSON.stringify(p.args)===JSON.stringify(item.args)&&JSON.stringify(p.extraEnv)===JSON.stringify(item.extraEnv)&&p.timeoutMs===item.timeoutMs&&p.profile===profile&&p.probeClosed===true&&p.snapshotClosed===true&&/^[a-f0-9]{64}$/.test(p.snapshotSHA256)&&new RegExp('^'+item.prefix+'[a-f0-9]{12}$').test(p.database)&&a?.profile===profile&&a.database===p.database&&a.createAcknowledged===true&&(item.id!=='N24-current-hour'||(/^[a-f0-9]{64}$/.test(p.n24CompletionSHA256)&&p.n24AppClosed===true&&p.n24SourceBeforeAfter===true&&p.n24ElapsedMs>=3600000));
  })&&report.adminClosures.length===profiles.length&&profiles.every(profile=>report.adminClosures.filter(row=>row.profile===profile&&row.closed===true&&row.error===undefined).length===1)&&
  final.length===profiles.length&&profiles.every(profile=>final.filter(row=>row.profile===profile&&row.closed===true&&row.zero===true&&row.error===undefined&&row.closeError===undefined&&Array.isArray(row.allOtherClients)&&row.allOtherClients.length===0).length===1);
}

export async function runFinalservicesNativeParent(contextBinding,argv=process.argv.slice(2)){
 const context=contextBinding;
 const spec=finalservicesCurrentParentArguments(argv,process.env,process.execArgv,context);refreshFinalservicesRootBinding(context,'execution');
 assert(!fs.existsSync(spec.output),'Never overwrite a prior native phase');
 const sourceCheck=()=>{refreshFinalservicesRootBinding(context,'execution');return verifyFinalservicesCurrentSource(spec.source,spec.manifestPath,spec.manifestSHA,context);};
 const initial=sourceCheck(),n24Bytes=fs.readFileSync(spec.n24Path);assert.equal(hash(n24Bytes),spec.n24SHA);
 assert.deepEqual(JSON.parse(n24Bytes),finalservicesN24Projection(initial),'N24 trusted hash must bind the exact whole current source capture');
 assertFinalservicesExecutionCapture(context,fs.readFileSync(spec.manifestPath),n24Bytes);verifyFinalservicesRawSource(initial,context);refreshFinalservicesRootBinding(context,'execution');
 // Only this point admits a driver import. Disabled/unbound/source/environment
 // refusal happens before PG import, output creation, allocation or any child.
 const pg=(await import(pathToFileURL(ROOT+'/node_modules/pg/lib/index.js').href)).default;
 fs.mkdirSync(spec.output);
 const report={phase:'CURRENT_FINALSERVICES_FULL31_NATIVE',binding:finalservicesBindingReceipt(context),finalBindingVerified:false,rootLeaseMutation:false,source:spec.source,profile:spec.profile,sourceManifestSHA256:spec.manifestSHA,n24SourceSHA256:spec.n24SHA,expectedCases:31,payloads:[],allocatedDatabases:[],closures:[],adminClosures:[],sourceObservations:[{stage:'initial',trackedCount:initial.trackedCount}],complete:false,leaseReleased:false,outerDeadlineFired:false,finalSourceVerified:false,finalN24ProjectionVerified:false,financialOFF:true};
 const save=()=>fs.writeFileSync(spec.output+'/result.json',JSON.stringify(report,null,2)+'\n');save();
 const profiles=spec.profile==='ci'?['ci']:[35439,35449];
 const contexts=new Map(profiles.map(profile=>{const name=profile==='ci'?'FINAL_SERVICES_CURRENT_NATIVE_CI_ADMIN_DATABASE_URL':'FINAL_SERVICES_CURRENT_NATIVE_'+String(profile).slice(-2)+'_ADMIN_DATABASE_URL';const endpoint=finalservicesCurrentEndpoint(process.env[name],profile,null,true);if(profile==='ci')endpoint.version=finalservicesHostedBackendVersion(contextBinding);return[profile,endpoint];}));
 const client=(context,database='postgres')=>{const u=new URL(context.u.href);u.pathname='/'+database;return new pg.Client({connectionString:u.href,connectionTimeoutMillis:10000,statement_timeout:10000});};
 async function attest(c,context,database){const row=(await c.query("SELECT current_user AS role,current_database() AS database,current_setting('server_version') AS version,current_setting('data_directory') AS directory,(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner")).rows[0];const u=new URL(context.u.href);u.pathname='/'+database;assertFinalservicesCurrentBackend(row,{...context,u});return row;}
 const admins=new Map();let failure=null;const begun=Date.now();
 const timer=setTimeout(()=>{report.outerDeadlineFired=true;save();},FINAL_SERVICES_CURRENT_BUDGET.parentMs);timer.unref();
 try{
  for(const[profile,context]of contexts){const c=client(context);admins.set(profile,c);await c.connect();report.closures.push({stage:'initial',profile,identity:await attest(c,context,'postgres'),allOtherClients:await finalservicesAllClientsZero(c)});save();}
  for(let index=0;index<spec.cases.length;index++){
   assert(!report.outerDeadlineFired,'Finite parent deadline reached; do not begin a new case');
   refreshFinalservicesRootBinding(contextBinding,'execution');
   const item=spec.cases[index],profile=spec.profile==='ci'?'ci':item.preferredLocalPort,context=contexts.get(profile),admin=admins.get(profile);
   assert(item.allowedLocalPorts.includes(item.preferredLocalPort));await finalservicesAllClientsZero(admin);
   const before=verifyFinalservicesRawSource(initial,contextBinding);report.sourceObservations.push({stage:'before '+item.id,...before});
   const database=item.prefix+crypto.randomBytes(6).toString('hex');finalservicesCurrentEndpoint(new URL('/'+database,context.u).href,profile,item.prefix);
   assert.equal((await admin.query('SELECT datname FROM pg_database WHERE datname=$1',[database])).rowCount,0,'Only a new uniquely allocated database');
   const allocation={profile,database,createAcknowledged:false};report.allocatedDatabases.push(allocation);save();await admin.query('CREATE DATABASE "'+database+'"');allocation.createAcknowledged=true;save();
   const p={id:item.id,file:item.file,args:[...item.args],extraEnv:{...item.extraEnv},profile,database,timeoutMs:item.timeoutMs,sourceBefore:true,sourceAfter:false,probeClosed:false,snapshotClosed:false,closed:false,exitObserved:false,logClosed:false,error:null,deadlineFired:false};report.payloads.push(p);save();
   const probe=client(context,database);
   try{await probe.connect();await probe.query('BEGIN READ ONLY');p.identity=await attest(probe,context,database);assert.deepEqual((await probe.query("SELECT n.nspname,c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' OR (n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%') ORDER BY n.nspname,c.relname")).rows,[]);assert.deepEqual((await probe.query("SELECT nspname FROM pg_namespace WHERE nspname NOT IN ('public','pg_catalog','information_schema') AND nspname NOT LIKE 'pg_toast%' AND nspname NOT LIKE 'pg_temp%' ORDER BY nspname")).rows,[]);assert.deepEqual((await probe.query("SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'")).rows,[]);await probe.query('ROLLBACK');}finally{await probe.end();p.probeClosed=true;save();}
   const folder=path.join(spec.output,String(index+1).padStart(2,'0')+'-'+item.feature+'-'+path.basename(item.file,'.js'));
   fs.mkdirSync(folder);const env={...process.env};
   for(const key of Object.keys(env))if(/DATABASE_URL$|^PG|^RC1|^P2_TEST|^FINAL_SERVICES_CURRENT_|^SYNDICATED_LOAN_NATIVE_|^COLLATERAL_AUCTION_|^PERFORMANCE_EMPLOYMENT_NATIVE_|^PROTECTION_CONTRACT_PROOF_DIRECTORY$|^NODE_OPTIONS$|^NODE_PATH$|^NODE_PG_FORCE_NATIVE$|^LEGAL_PROFILE_DEFER$|^GENESIS_AUCTION_MANIFEST_/i.test(key))delete env[key];
   Object.assign(env,FINAL_SERVICES_CURRENT_LEGAL,{CHAIN_ENABLED:'off',RESOURCE_ECONOMY:'off',SOCIAL_VERIFY_MODE:'off',[item.databaseEnv]:new URL('/'+database,context.u).href},item.extraEnv);
   if(item.feature==='N22')env.SYNDICATED_LOAN_NATIVE_PROOFS=folder+'/leaf-proofs';
   if(item.feature==='N26')env.PERFORMANCE_EMPLOYMENT_NATIVE_PROOFS=folder+'/leaf-proofs';
   if(item.feature==='N28')env.PROTECTION_CONTRACT_PROOF_DIRECTORY=folder+'/leaf-proofs';
   if(item.id==='N24-current-hour')Object.assign(env,{COLLATERAL_AUCTION_CURRENT_SOURCE_PATH:spec.n24Path,COLLATERAL_AUCTION_CURRENT_SOURCE_SHA256:spec.n24SHA,COLLATERAL_AUCTION_CURRENT_SOURCE_REVISION:spec.source,COLLATERAL_AUCTION_CURRENT_PROOFS:folder+'/leaf-proofs'});
   const log=folder+'/native.log',fd=fs.openSync(log,'wx');p.startedAt=new Date().toISOString();const start=Date.now();let childTimer;
   try{await new Promise(resolve=>{
    let child;try{child=spawn(process.execPath,item.args,{cwd:ROOT,env,windowsHide:true,stdio:['ignore',fd,fd],timeout:item.timeoutMs});}catch(e){p.error={message:e.message,code:e.code??null};resolve();return;}
    p.pid=child.pid;save();childTimer=setTimeout(()=>{p.deadlineFired=true;save();},item.timeoutMs);childTimer.unref();
    child.once('error',e=>{p.error={message:e.message,code:e.code??null};});
    child.once('exit',(code,signal)=>{p.exitObserved=true;p.exitCode=code;p.exitSignal=signal;});
    child.once('close',(code,signal)=>{clearTimeout(childTimer);p.closed=true;p.code=code;p.signal=signal;resolve();});
   });}finally{clearTimeout(childTimer);fs.closeSync(fd);p.logClosed=true;}
   p.durationMs=Date.now()-start;if(p.durationMs>item.timeoutMs)p.deadlineFired=true;p.log=log;p.logSHA256=hash(fs.readFileSync(log));save();
   const after=verifyFinalservicesRawSource(initial,contextBinding);assert.deepEqual(after,before);p.sourceAfter=true;report.sourceObservations.push({stage:'after '+item.id,...after});save();
   assert(finalservicesNormalChild(p),'Nonzero, signal, timeout, spawn/FD/source failure: automatic lease release is forbidden');
   refreshFinalservicesRootBinding(contextBinding,'execution');
   const reader=client(context,database);
   try{await reader.connect();await reader.query('BEGIN READ ONLY');await attest(reader,context,database);const names=(await reader.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename),expected=[...initial.canonicalTables,...initial.runtimeExtraTables].sort();assert.deepEqual(names,expected,'Exactly594 canonical tables plus the genuine reset marker, no hidden fixture or unknown tables');
    const tables={};for(const name of names){assert.match(name,/^[a-z_][a-z_0-9]*$/);tables[name]=(await reader.query('SELECT row_to_json(t)::text AS value FROM "public"."'+name+'" t')).rows.map(r=>r.value).sort();}
    const sequences=(await reader.query("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")).rows;
    const snapshot=folder+'/whole-world.json';fs.writeFileSync(snapshot,JSON.stringify({source:spec.source,database,tables,sequences},null,2)+'\n',{flag:'wx'});p.snapshotSHA256=hash(fs.readFileSync(snapshot));p.snapshot=snapshot;p.snapshotTables=names.length;await reader.query('ROLLBACK');
   }finally{await reader.end();p.snapshotClosed=true;save();}
   if(item.id==='N24-current-hour'){
    const n24=JSON.parse(fs.readFileSync(folder+'/leaf-proofs/current-complete.json'));assert.equal(n24.appClosed,true);assert.equal(n24.originalLong,true);assert.equal(n24.currentFinalACK,true);assert.equal(n24.leaseReleaseClaim,false);assert(n24.elapsedMs>=3600000);const expected={revision:spec.source,gitTree:initial.tree,files:initial.records.length,captureSHA256:spec.n24SHA};assert.deepEqual(n24.sourceBefore,expected);assert.deepEqual(n24.sourceAfter,expected);p.n24CompletionSHA256=hash(fs.readFileSync(folder+'/leaf-proofs/current-complete.json'));p.n24AppClosed=true;p.n24SourceBeforeAfter=true;p.n24ElapsedMs=n24.elapsedMs;
   }
   await finalservicesAllClientsZero(admin);save();
  }
 }catch(e){failure=e;report.failure={message:e.message,stack:e.stack};save();}
 finally{
  for(const[profile,c]of admins){const row={profile,closed:false};report.adminClosures.push(row);try{await c.end();row.closed=true;}catch(e){failure??=e;row.error=e.message;}}
  try{const final=sourceCheck();assert.deepEqual(final,initial);report.finalSourceVerified=true;assert.equal(hash(fs.readFileSync(spec.n24Path)),spec.n24SHA);assert.deepEqual(JSON.parse(fs.readFileSync(spec.n24Path)),finalservicesN24Projection(final));report.finalN24ProjectionVerified=true;refreshFinalservicesRootBinding(contextBinding,'execution');assert.deepEqual(finalservicesBindingReceipt(contextBinding),report.binding);report.finalBindingVerified=true;}catch(e){failure??=e;report.sourceError=e.message;}
  // An abnormal native process may have surviving descendants even if its SQL
  // session disappeared. Never turn an early/failed prefix into lease release.
  if(failure===null&&report.payloads.length===31&&report.payloads.every(finalservicesNormalChild))for(const[profile,context]of contexts){const c=client(context),row={stage:'final',profile,closed:false};report.closures.push(row);try{await c.connect();row.identity=await attest(c,context,'postgres');row.allOtherClients=await finalservicesAllClientsZero(c);row.zero=true;}catch(e){failure??=e;row.error=e.message;}finally{try{await c.end();row.closed=true;}catch(e){failure??=e;row.closeError=e.message;}}}
  clearTimeout(timer);report.elapsedMs=Date.now()-begun;if(report.elapsedMs>FINAL_SERVICES_CURRENT_BUDGET.parentMs)report.outerDeadlineFired=true;
  if(report.outerDeadlineFired)failure??=Error('Finite parent deadline reached; independent closure required');if(failure&&!report.failure)report.failure={message:failure.message,stack:failure.stack};
  const candidate=report.finalBindingVerified===true&&finalservicesCanRelease(report,spec,profiles,failure);report.finishedAt=new Date().toISOString();
  try{if(candidate)fs.writeFileSync(spec.output+'/lease-release.json',JSON.stringify({binding:report.binding,rootLeaseMutation:false,source:spec.source,at:report.finishedAt,complete:true,cases:31,allClientsZero:true,normalChildrenAndFDLogsClosed:true,adminsAndReadersClosed:true,sourceBeforeAfterVerified:true,n24TrustedProjectionVerified:true,driverExitCloseRequired:true,financialOFF:true},null,2)+'\n',{flag:'wx'});report.complete=candidate;report.leaseReleased=candidate;save();}
  catch(e){failure??=e;report.complete=false;report.leaseReleased=false;report.failure={message:failure.message,stack:failure.stack};try{save();}catch(recordError){report.recordError=recordError.message;}}
 }
 if(failure)throw failure;assert(report.complete);console.log(JSON.stringify({source:spec.source,cases:31,complete:true,financialOFF:true}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runFinalservicesNativeParent();
