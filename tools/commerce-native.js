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
  const rollover=cases.filter(c=>c.timeoutMs===660000);
  assert.equal(rollover.length,1,'One price-block rollover allowance only');
  assert.equal(rollover[0].file,'test/commercialcampaigns-integration.js');
  assert(cases.every(c=>[240000,300000].includes(c.timeoutMs)||c===rollover[0]),'Original caps plus the one bounded rollover leaf only');
  const leafCapsMs=cases.reduce((n,c)=>n+c.timeoutMs,0),parentOverheadMs=1800000,captureCapMs=600000,parentClosureMarginMs=300000;
  return{mode,profile,allowed,cases,leafCapsMs,parentOverheadMs,captureCapMs,parentClosureMarginMs,parentCapMs:leafCapsMs+parentOverheadMs+parentClosureMarginMs,driverCapMs:leafCapsMs+parentOverheadMs+captureCapMs+parentClosureMarginMs};
}

// Failure-only bounded evidence; this never changes admission, cleanup or release.
function commerceNativeFailureDiagnostics(report,spec,outputRoot,id){
  const reject=code=>{const error=Error(code);error.diagnosticCode=code;throw error;},check=(value,code)=>{if(!value)reject(code);};
  const base=path.resolve(outputRoot),expectedOutput=path.join(base,'commerce-current-native-'+id),expectedManifest=path.join(base,'commerce-current-source-'+id+'.json'),TAIL=16384,JSON_LIMIT=262144,LOG_LIMIT=8388608;
  check(/^[a-f0-9]{40}$/.test(report.source)&&new RegExp('^'+report.source.slice(0,8)+'-[a-f0-9]{12}$').test(id),'IDENTITY');
  check(report.phase==='CURRENT_COMMERCE_FULL_COHORT_DRIVER'&&report.profile===spec.profile&&['ci','local'].includes(spec.profile)&&spec.mode==='--'+spec.profile,'PROFILE');
  check(report.output===expectedOutput&&report.manifest===expectedManifest&&report.complete===false&&report.leaseReleased===false,'PATH_OR_STATE');
  const directory=fs.lstatSync(base);check(directory.isDirectory()&&!directory.isSymbolicLink()&&fs.realpathSync(base)===base,'OUTPUT_ROOT');
  const same=(a,b)=>['dev','ino','mode','uid','size','mtimeMs','nlink'].every(k=>a[k]===b[k]);
  const read=(file,limit,tail,expectedSHA)=>{
    check(path.isAbsolute(file)&&path.resolve(file)===file,'NONCANONICAL_PATH');const relative=path.relative(base,file);check(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'ESCAPED_PATH');
    let current=base;for(const part of relative.split(path.sep).slice(0,-1)){current=path.join(current,part);const s=fs.lstatSync(current);check(s.isDirectory()&&!s.isSymbolicLink()&&fs.realpathSync(current)===current,'FOREIGN_DIRECTORY');}
    const before=fs.lstatSync(file);check(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.uid===directory.uid&&Number.isSafeInteger(before.size)&&before.size>=0&&fs.realpathSync(file)===file,'FOREIGN_FILE');check(tail?before.size<=LOG_LIMIT:before.size<=limit,tail?'OVERSIZE_LOG':'OVERSIZE_JSON');if(tail)check(typeof expectedSHA==='string'&&/^[a-f0-9]{64}$/.test(expectedSHA),'LOG_HASH');
    const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));let bytes;
    try{check(same(before,fs.fstatSync(fd)),'CHANGED_FILE');const size=before.size,start=0;bytes=Buffer.alloc(size);let n=0;while(n<size){const got=fs.readSync(fd,bytes,n,size-n,start+n);check(got>0,'INCOMPLETE_READ');n+=got;}check(same(before,fs.fstatSync(fd)),'CHANGED_FILE');}
    finally{fs.closeSync(fd);}
    check(same(before,fs.lstatSync(file))&&fs.realpathSync(file)===file,'CHANGED_PATH');const wholeSHA256=crypto.createHash('sha256').update(bytes).digest('hex'),readBytes=bytes.length,truncated=before.size>limit;
    if(expectedSHA)check(wholeSHA256===expectedSHA,'LOG_HASH');if(tail&&truncated)bytes=bytes.subarray(bytes.length-limit);
    return{file,totalBytes:before.size,readBytes,selectedBytes:bytes.length,truncated,selectedSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),recordedWholeSHA256:expectedSHA??null,wholeSHA256Verified:!!expectedSHA,bytes};
  };
  let emitted=0;const emit=(kind,value)=>{const text=JSON.stringify({diagnostic:'COMMERCE_NATIVE_FAILURE_ONLY',kind,source:report.source,id,...value});check(Buffer.byteLength(text)<=65536,'OVERSIZE_DIAGNOSTIC');console.error(text);emitted++;};
  const unavailable=(kind,e)=>emit(kind,{unavailable:true,code:typeof e?.diagnosticCode==='string'?e.diagnosticCode:'MISSING_OR_UNREADABLE'});
  const log=(kind,file,expectedSHA)=>{try{const r=read(file,TAIL,true,expectedSHA),{bytes,...meta}=r;emit(kind,{...meta,text:bytes.toString('utf8'),base64:bytes.toString('base64')});}catch(e){unavailable(kind,e);}};
  check(Array.isArray(report.children)&&report.children.length>=1&&report.children.length<=2,'CHILDREN');const child=report.children.at(-1);check(['capture','native'].includes(child.stage),'STAGE');
  emit('journal',{phase:report.phase,profile:report.profile,cases:report.cases,manifest:report.manifest,manifestSHA256:report.manifestSHA256??null,output:report.output,complete:false,leaseReleased:false,child:{stage:child.stage,pid:child.pid??null,closed:child.closed,exitObserved:child.exitObserved,logClosed:child.logClosed,code:child.code??null,signal:child.signal??null,deadlineFired:child.deadlineFired,error:child.error??null},failure:{message:String(report.failure?.message??'').slice(0,8192),stack:String(report.failure?.stack??'').slice(0,8192)}});
  check(child.closed===true&&child.exitObserved===true&&child.logClosed===true,'UNCLOSED_STAGE');const stageLog=path.join(base,'commerce-current-native-driver-'+id+'-'+child.stage+'.log');check(child.log===stageLog,'STAGE_LOG_PATH');
  log('stage-log',stageLog,child.logSHA256);
  if(child.stage==='native'){
    let parent;try{const r=read(path.join(expectedOutput,'result.json'),JSON_LIMIT,false),bytes=r.bytes;parent=JSON.parse(bytes.toString('utf8'));check(parent.source===report.source&&parent.profile===spec.profile&&parent.expectedCases===spec.cases.length,'PARENT_IDENTITY');check(Array.isArray(parent.payloads)&&parent.payloads.length<=spec.cases.length,'PAYLOADS');
      emit('parent-result',{file:r.file,selectedSHA256:r.selectedSHA256,complete:parent.complete,leaseReleased:parent.leaseReleased,failure:parent.failure??null,sourceError:parent.sourceError??null,payloadCount:parent.payloads.length});
    }catch(e){unavailable('parent-result',e);return{emitted};}
    if(parent.payloads.length){const index=parent.payloads.length-1,p=parent.payloads[index],item=spec.cases[index],profile=spec.profile==='ci'?'ci':item.preferredLocalPort;try{
      check(p.file===item.file&&p.profile===profile&&Array.isArray(p.args)&&p.args.length===2&&p.args[0]===item.file&&p.args[1]==='--postgres','LEAF_IDENTITY');check(p.closed===true&&p.logClosed===true,'UNCLOSED_LEAF');
      const folder=path.join(expectedOutput,String(index+1).padStart(2,'0')+'-'+path.basename(item.file,'.js')+'-'+profile),leafLog=folder+'/native.log';check(p.log===leafLog,'LEAF_LOG_PATH');emit('last-payload',{index,file:p.file,profile:p.profile,pid:p.pid??null,code:p.code??null,signal:p.signal??null,error:p.error??null,deadlineFired:p.deadlineFired,closed:p.closed,logClosed:p.logClosed,sourceAfter:p.sourceAfter});log('leaf-log',path.resolve(leafLog),p.logSHA256);
    }catch(e){unavailable('last-payload',e);}}
  }
  return{emitted};
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
  }catch(e){report.failure={message:e.message,stack:e.stack};report.complete=false;report.leaseReleased=false;try{commerceNativeFailureDiagnostics(report,spec,outputRoot,id);}catch{}throw e;}
  finally{report.finishedAt=new Date().toISOString();save();}
  console.log(JSON.stringify({source,profile:spec.profile,cases:spec.cases.length,complete:report.complete,journal,output}));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runCommerceNative();
