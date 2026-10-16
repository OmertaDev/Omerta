import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {commerceCurrentRoot as ROOT,assertCommerceCurrentEnvironment,commerceCurrentEndpoint} from './commerce-current-native-guard.js';
import {COMMERCE_CURRENT_LOCAL_CASES,COMMERCE_CURRENT_CI_CASES,COMMERCE_CURRENT_LEGAL} from './commerce-current-native-data.js';

export function commerceNativeInvocation(argv,env,execArgv){
  assert.equal(argv.length,1,'Only one exact full-cohort mode');
  const mode=argv[0];assert(['--local','--ci'].includes(mode));
  const profile=mode.slice(2),allowed=profile==='ci'?['COMMERCE_CURRENT_NATIVE_CI_ADMIN_DATABASE_URL']:['COMMERCE_CURRENT_NATIVE_39_ADMIN_DATABASE_URL','COMMERCE_CURRENT_NATIVE_49_ADMIN_DATABASE_URL'];
  assertCommerceCurrentEnvironment(env,execArgv,allowed);
  for(const key of Object.keys(env))if(/^COMMERCE_CURRENT_NATIVE_/i.test(key))assert(allowed.includes(key),'No ambient current-phase selector');
  for(const key of allowed)assert(Object.hasOwn(env,key),'Explicit admin target required');
  if(profile==='ci')commerceCurrentEndpoint(env[allowed[0]],'ci',null,true);
  else for(const port of[35439,35449])commerceCurrentEndpoint(env['COMMERCE_CURRENT_NATIVE_'+String(port).slice(-2)+'_ADMIN_DATABASE_URL'],port,null,true);
  const cases=profile==='ci'?COMMERCE_CURRENT_CI_CASES:COMMERCE_CURRENT_LOCAL_CASES;
  assert.equal(cases.length,profile==='ci'?33:35);
  assert(cases.every(c=>[240000,300000].includes(c.timeoutMs)),'Original per-leaf caps only');
  const leafCapsMs=cases.reduce((n,c)=>n+c.timeoutMs,0),parentOverheadMs=1800000,captureCapMs=600000,parentClosureMarginMs=300000;
  return{mode,profile,allowed,cases,leafCapsMs,parentOverheadMs,captureCapMs,parentClosureMarginMs,parentCapMs:leafCapsMs+parentOverheadMs+parentClosureMarginMs,driverCapMs:leafCapsMs+parentOverheadMs+captureCapMs+parentClosureMarginMs};
}

export async function runCommerceNative(){
  const spec=commerceNativeInvocation(process.argv.slice(2),process.env,process.execArgv);
  const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024}).trim();
  const source=git('rev-parse','HEAD');assert.match(source,/^[a-f0-9]{40}$/);
  assert.equal(git('status','--porcelain=v1','--untracked-files=all'),'','Actual clean authored source required');
  const outputRoot=path.join(ROOT,'output');if(!fs.existsSync(outputRoot))fs.mkdirSync(outputRoot);
  const stat=fs.lstatSync(outputRoot);assert(stat.isDirectory()&&!stat.isSymbolicLink());
  const id=source.slice(0,8)+'-'+crypto.randomBytes(6).toString('hex'),manifest=path.join(outputRoot,'commerce-current-source-'+id+'.json'),output=path.join(outputRoot,'commerce-current-native-'+id),journal=path.join(outputRoot,'commerce-current-native-driver-'+id+'.json');
  for(const file of[manifest,output,journal])assert(!fs.existsSync(file),'Never overwrite a proof phase');
  const report={phase:'CURRENT_COMMERCE_FULL_COHORT_DRIVER',source,profile:spec.profile,cases:spec.cases.length,budget:{leafCapsMs:spec.leafCapsMs,parentOverheadMs:spec.parentOverheadMs,captureCapMs:spec.captureCapMs,parentClosureMarginMs:spec.parentClosureMarginMs,driverCapMs:spec.driverCapMs,provenance:'NEW finite wrapper bounds; unchanged leaf caps plus declared30-minute parent overhead,10-minute source capture and5-minute parent closure margin; not historical measured duration'},manifest,output,children:[],complete:false,leaseReleased:false,startedAt:new Date().toISOString(),financialOFF:true};
  fs.writeFileSync(journal,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  const save=()=>fs.writeFileSync(journal,JSON.stringify(report,null,2)+'\n');
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  const env={...process.env,...COMMERCE_CURRENT_LEGAL,CHAIN_ENABLED:'off',RESOURCE_ECONOMY:'off',SOCIAL_VERIFY_MODE:'off'};
  const run=async(stage,args,childEnv,capMs)=>{
    const row={stage,args,capMs,startedAt:new Date().toISOString(),closed:false,exitObserved:false,logClosed:false,error:null,deadlineFired:false},log=path.join(outputRoot,'commerce-current-native-driver-'+id+'-'+stage+'.log');report.children.push(row);save();
    const fd=fs.openSync(log,'wx'),start=Date.now(),timer=setTimeout(()=>{row.deadlineFired=true;save();},capMs);timer.unref();
    try{await new Promise(resolve=>{let child;try{child=spawn(process.execPath,args,{cwd:ROOT,env:childEnv,windowsHide:true,stdio:['ignore',fd,fd],timeout:capMs});}catch(e){row.error={message:e.message,code:e.code??null};row.closed=true;clearTimeout(timer);resolve();return;}row.pid=child.pid;save();child.once('error',e=>{row.error={message:e.message,code:e.code??null};});child.once('exit',(code,signal)=>{row.exitObserved=true;row.exitCode=code;row.exitSignal=signal;});child.once('close',(code,signal)=>{clearTimeout(timer);row.closed=true;row.code=code;row.signal=signal;resolve();});});}
    finally{clearTimeout(timer);fs.closeSync(fd);row.logClosed=true;}
    row.durationMs=Date.now()-start;if(row.durationMs>capMs)row.deadlineFired=true;row.log=log;row.logSHA256=sha(fs.readFileSync(log));save();
    assert(row.closed&&row.exitObserved&&row.logClosed&&row.code===0&&row.exitCode===0&&row.signal===null&&row.exitSignal===null&&row.error===null&&!row.deadlineFired,'Child or descriptor failure; no automatic lease release');
  };
  try{
    const captureEnv={...env};for(const key of spec.allowed)delete captureEnv[key];
    await run('capture',['tools/commerce-current-native-guard.js',source,manifest],captureEnv,spec.captureCapMs);
    const bytes=fs.readFileSync(manifest),capture=JSON.parse(bytes);assert.equal(capture.source,source);assert.equal(capture.phase,'GENUINE_CURRENT_SOURCE_CAPTURE_NOT_NATIVE');
    report.manifestSHA256=sha(bytes);report.sourceTrackedFiles=capture.trackedCount;save();
    await run('native',['tools/commerce-current-native.js',spec.mode,source,manifest,report.manifestSHA256,output],env,spec.parentCapMs);
    const resultBytes=fs.readFileSync(output+'/result.json'),result=JSON.parse(resultBytes),releaseBytes=fs.readFileSync(output+'/lease-release.json'),release=JSON.parse(releaseBytes);
    assert.equal(result.source,source);assert.equal(result.profile,spec.profile);assert.equal(result.expectedCases,spec.cases.length);assert.equal(result.payloads.length,spec.cases.length);assert.equal(result.complete,true);assert.equal(result.leaseReleased,true);assert.equal(result.finalSourceVerifiedAfterComparison,true);
    for(let i=0;i<spec.cases.length;i++){assert.equal(result.payloads[i].file,spec.cases[i].file);assert.equal(result.payloads[i].profile,spec.profile==='ci'?'ci':spec.cases[i].preferredLocalPort);}
    assert.equal(release.source,source);assert.equal(release.complete,true);assert.equal(release.allClientsZero,true);assert.equal(release.adminAndReadersClosed,true);assert.equal(release.normalChildrenAndFDLogsClosed,true);
    assert.equal(git('rev-parse','HEAD'),source);assert.equal(git('status','--porcelain=v1','--untracked-files=all'),'');
    report.nativeResultSHA256=sha(resultBytes);report.nativeReleaseSHA256=sha(releaseBytes);report.complete=true;report.leaseReleased=true;
  }catch(e){report.failure={message:e.message,stack:e.stack};report.complete=false;report.leaseReleased=false;throw e;}
  finally{report.finishedAt=new Date().toISOString();save();}
  console.log(JSON.stringify({source,profile:spec.profile,cases:spec.cases.length,complete:report.complete,journal,output}));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runCommerceNative();
