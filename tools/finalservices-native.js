import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {finalservicesCurrentRoot as ROOT,assertFinalservicesCurrentEnvironment,assertFinalservicesBoundSource,finalservicesCurrentEndpoint,finalservicesN24Projection,verifyFinalservicesRawSource,refreshFinalservicesRootBinding,finalservicesBindingReceipt,assertFinalservicesExecutionCapture,finalservicesBindingChildArguments,sealFinalservicesHostedExecution} from './finalservices-current-native-guard.js';
import {FINAL_SERVICES_CURRENT_CASES,FINAL_SERVICES_CURRENT_BUDGET,FINAL_SERVICES_CURRENT_LEGAL} from './finalservices-current-native-data.js';

const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
export function finalservicesNativeInvocation(argv,env,execArgv){
 assert.equal(argv.length,1,'Only the entire current final-services cohort');assert(['--local','--ci'].includes(argv[0]));
 const profile=argv[0].slice(2),allowed=profile==='ci'?['FINAL_SERVICES_CURRENT_NATIVE_CI_ADMIN_DATABASE_URL']:['FINAL_SERVICES_CURRENT_NATIVE_39_ADMIN_DATABASE_URL','FINAL_SERVICES_CURRENT_NATIVE_49_ADMIN_DATABASE_URL'];
 assertFinalservicesCurrentEnvironment(env,execArgv,allowed);
 if(profile==='ci')assert.equal(env.CI,'true','Genuine CI mode only');
 for(const key of allowed)assert(Object.hasOwn(env,key),'Exact explicit admin target required');
 if(profile==='ci')finalservicesCurrentEndpoint(env[allowed[0]],'ci',null,true);else for(const port of[35439,35449])finalservicesCurrentEndpoint(env['FINAL_SERVICES_CURRENT_NATIVE_'+String(port).slice(-2)+'_ADMIN_DATABASE_URL'],port,null,true);
 assert.equal(FINAL_SERVICES_CURRENT_CASES.length,31);assert.equal(FINAL_SERVICES_CURRENT_CASES.reduce((n,c)=>n+c.timeoutMs,0),FINAL_SERVICES_CURRENT_BUDGET.leafMs);
 assert(FINAL_SERVICES_CURRENT_BUDGET.ciJobMinutes*60000>FINAL_SERVICES_CURRENT_BUDGET.driverMs);
 return{mode:argv[0],profile,allowed,cases:FINAL_SERVICES_CURRENT_CASES,budget:FINAL_SERVICES_CURRENT_BUDGET};
}
export async function runFinalservicesNative(context,argv=process.argv.slice(2)){
 const spec=finalservicesNativeInvocation(argv,process.env,process.execArgv);assert.equal(spec.profile,context?.kind==='hosted'?'ci':'local','CI requires an explicit staged hosted context; local Root grants remain local');refreshFinalservicesRootBinding(context,'driver-start');
 const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:64*1024*1024}).trim();
 const source=context.anchor.source;assertFinalservicesBoundSource(source,context);assert.equal(git('rev-parse','HEAD'),source);assert.equal(git('status','--porcelain=v1','--untracked-files=all'),'');
 const base=path.join(ROOT,'output');if(!fs.existsSync(base))fs.mkdirSync(base);const st=fs.lstatSync(base);assert(st.isDirectory()&&!st.isSymbolicLink());
 const id=source.slice(0,8)+'-'+context.documents.execution.runNonce.slice(0,12),{manifest,n24,output,journal}=context.documents.execution.outputs;
 for(const f of[manifest,n24,output,journal])assert(!fs.existsSync(f),'Preserve every prior proof phase');
 const report={phase:'CURRENT_FINALSERVICES_FULL31_DRIVER',binding:finalservicesBindingReceipt(context),initialBinding:finalservicesBindingReceipt(context),rootLeaseMutation:false,source,profile:spec.profile,budget:spec.budget,children:[],manifest,n24,output,complete:false,leaseReleased:false,financialOFF:true,startedAt:new Date().toISOString()};
 fs.writeFileSync(journal,JSON.stringify(report,null,2)+'\n',{flag:'wx'});const save=()=>fs.writeFileSync(journal,JSON.stringify(report,null,2)+'\n');
 const env={...process.env,...FINAL_SERVICES_CURRENT_LEGAL,CHAIN_ENABLED:'off',RESOURCE_ECONOMY:'off',SOCIAL_VERIFY_MODE:'off'};
 async function run(stage,args,childEnv,timeoutMs){
  refreshFinalservicesRootBinding(context,stage==='capture'?'capture':'execution');
  const row={stage,args,timeoutMs,closed:false,exitObserved:false,logClosed:false,error:null,deadlineFired:false};report.children.push(row);save();
  const log=path.join(base,'finalservices-current-driver-'+id+'-'+stage+'.log'),fd=fs.openSync(log,'wx'),begun=Date.now();let timer;
  try{await new Promise(resolve=>{let child;try{child=spawn(process.execPath,args,{cwd:ROOT,env:childEnv,windowsHide:true,stdio:['ignore',fd,fd],timeout:timeoutMs});}catch(e){row.error={message:e.message,code:e.code??null};resolve();return;}row.pid=child.pid;save();timer=setTimeout(()=>{row.deadlineFired=true;save();},timeoutMs);timer.unref();child.once('error',e=>{row.error={message:e.message,code:e.code??null};});child.once('exit',(code,signal)=>{row.exitObserved=true;row.exitCode=code;row.exitSignal=signal;});child.once('close',(code,signal)=>{clearTimeout(timer);row.closed=true;row.code=code;row.signal=signal;resolve();});});}
  finally{clearTimeout(timer);fs.closeSync(fd);row.logClosed=true;}
  row.elapsedMs=Date.now()-begun;if(row.elapsedMs>timeoutMs)row.deadlineFired=true;row.log=log;row.logSHA256=hash(fs.readFileSync(log));save();
  assert(row.closed&&row.exitObserved&&row.logClosed&&row.code===0&&row.exitCode===0&&row.signal===null&&row.exitSignal===null&&row.error===null&&!row.deadlineFired,'Abnormal/unknown descendant closure; no automatic lease release');
 }
 try{
  const captureEnv={...env};for(const key of spec.allowed)delete captureEnv[key];
  await run('capture',finalservicesBindingChildArguments(context,'capture'),captureEnv,spec.budget.sourceCaptureMs);
  const bytes=fs.readFileSync(manifest),capture=JSON.parse(bytes);assert.equal(capture.phase,'GENUINE_CURRENT_SOURCE_CAPTURE_NOT_NATIVE');assert.equal(capture.source,source);
  const n24Bytes=Buffer.from(JSON.stringify(finalservicesN24Projection(capture),null,2)+'\n');fs.writeFileSync(n24,n24Bytes,{flag:'wx'});
  if(context.kind==='hosted'){context=sealFinalservicesHostedExecution(context,bytes,n24Bytes);report.binding=finalservicesBindingReceipt(context);}assertFinalservicesExecutionCapture(context,bytes,n24Bytes);report.manifestSHA256=hash(bytes);report.n24SHA256=hash(n24Bytes);save();
  await run('native',finalservicesBindingChildArguments(context,'parent'),env,spec.budget.parentMs+spec.budget.parentClosureMarginMs);
  const resultBytes=fs.readFileSync(output+'/result.json'),releaseBytes=fs.readFileSync(output+'/lease-release.json'),result=JSON.parse(resultBytes),release=JSON.parse(releaseBytes);
  assert.equal(result.source,source);assert.equal(result.profile,spec.profile);assert.equal(result.complete,true);assert.equal(result.leaseReleased,true);assert.equal(result.finalSourceVerified,true);assert.equal(result.finalN24ProjectionVerified,true);assert.equal(result.expectedCases,31);assert.equal(result.payloads.length,31);
  for(let i=0;i<31;i++){assert.equal(result.payloads[i].id,spec.cases[i].id);assert.deepEqual(result.payloads[i].args,spec.cases[i].args);assert.deepEqual(result.payloads[i].extraEnv,spec.cases[i].extraEnv);}
  assert.equal(release.source,source);assert.equal(release.cases,31);for(const key of['complete','allClientsZero','normalChildrenAndFDLogsClosed','adminsAndReadersClosed','sourceBeforeAfterVerified','n24TrustedProjectionVerified','driverExitCloseRequired','financialOFF'])assert.equal(release[key],true);
  assert.equal(result.finalBindingVerified,true);assert.deepEqual(result.binding,report.binding);assert.deepEqual(release.binding,report.binding);assert.equal(release.rootLeaseMutation,false);refreshFinalservicesRootBinding(context,'execution');verifyFinalservicesRawSource(capture,context);assert.equal(git('rev-parse','HEAD'),source);assert.equal(git('status','--porcelain=v1','--untracked-files=all'),'');
  report.nativeResultSHA256=hash(resultBytes);report.releaseSHA256=hash(releaseBytes);report.complete=true;report.leaseReleased=true;
 }catch(e){report.failure={message:e.message,stack:e.stack};report.complete=false;report.leaseReleased=false;throw e;}
 finally{report.finishedAt=new Date().toISOString();save();}
 console.log(JSON.stringify({source,profile:spec.profile,cases:31,complete:true,journal,output}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runFinalservicesNative();
