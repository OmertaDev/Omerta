// Actual SQLite/local-filesystem tests. Children use only this test's verified private directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fork} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createWalletComputeJournal,openWalletComputeJournal} from '../tools/wallet-compute-journal.js';
import {createWalletComputeJournalState,createWalletComputeClient,WALLET_COMPUTE_USDC} from '../tools/wallet-compute-client.js';

const SELF=fileURLToPath(import.meta.url),WALLET='0x08040DF46BFEc0424ba9e3CBFAA3638369305Dd8',PAYEE='0x000000000000000000000000000000000000dEaD';
const NOW=1672531205000,URL='https://example.invalid/compute',MODEL='offline/model';
const sha=s=>createHash('sha256').update(s).digest('hex');
const policy=()=>({perCallAtoms:'1',dailyAtoms:'1',totalAtoms:'1',authorizationSeconds:55,resources:[{url:URL,payTo:PAYEE,models:[MODEL]}]});
const initial=()=>createWalletComputeJournalState({enabled:true,walletAddress:WALLET,policy:policy()});
const initialState=initial(),scope=initialState.scope,policyDigest=initialState.policyDigest;
const config=file=>({enabled:true,path:file,scope,policyDigest});
const advance=(state,change=()=>{})=>{const next=structuredClone(state);next.revision++;next.lastNowMs=Math.max(NOW,next.lastNowMs+1);change(next);return next;};
function quoteEntry(state,id){return advance(state,s=>s.attempts.push({id,url:URL,model:MODEL,requestDigest:sha(id+'request'),bodyDigest:sha(id+'body'),startedAtMs:s.lastNowMs,updatedAtMs:s.lastNowMs,dayUTC:new Date(s.lastNowMs).toISOString().slice(0,10),state:'quoting',amountAtoms:'0',merchant:null,quoteDigest:null,typedDataHash:null,nonceHash:null,validAfter:null,validBefore:null,signatureHash:null}));}
function reserveEntry(state,id){return advance(state,s=>{if(s.attempts.reduce((n,e)=>n+BigInt(e.amountAtoms),0n)+1n>1n)throw Object.assign(Error('CAP_HELD'),{code:'CAP_HELD'});const e=s.attempts.find(e=>e.id===id);Object.assign(e,{state:'reserved',amountAtoms:'1',merchant:PAYEE.toLowerCase(),quoteDigest:sha(id+'quote'),typedDataHash:sha(id+'typed'),nonceHash:sha(id+'nonce'),validAfter:'1672531200',validBefore:'1672531260',updatedAtMs:s.lastNowMs});});}
const pause=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function childMain(input){
  let journal,mutations=0;
  if(input.mode==='hot-write'){
    const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(input.file,{timeout:2000,allowExtension:false});
    db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=EXTRA; PRAGMA cache_size=1; BEGIN IMMEDIATE; UPDATE wallet_compute_journal SET revision=revision+1;');
    assert(fs.statSync(input.file+'-journal').isFile());process.send({type:'hot-write-ready'});setInterval(()=>{},1000);return;
  }
  journal=await openWalletComputeJournal({...config(input.file),busyTimeoutMs:input.busy??2000});
  process.send({type:'ready'});await new Promise(resolve=>process.once('message',m=>{assert.equal(m.type,'go');resolve();}));
  try{
    if(input.mode==='before-commit'){
      journal.transact(scope,s=>{mutations++;const next=advance(s);process.send({type:'before-commit',mutations});pause(30000);return next;});throw Error('Expected parent kill');
    }
    if(input.mode==='after-commit'){
      const receipt=journal.transact(scope,s=>{mutations++;return advance(s);});process.send({type:'after-commit',mutations,state:receipt.state,committed:receipt.committed,durable:receipt.durable});setInterval(()=>{},1000);return;
    }
    if(input.mode==='compete'){
      let beginCalls=0,reserveCalls=0;const start=Date.now();
      journal.transact(scope,s=>{beginCalls++;if(input.notice){fs.writeFileSync(input.notice,'lock-held',{flag:'wx'});pause(input.holdMs);}return quoteEntry(s,input.id);});
      let result='held';try{journal.transact(scope,s=>{reserveCalls++;return reserveEntry(s,input.id);});}catch(e){assert.equal(e.code,'CAP_HELD');result='budget-refused';}
      journal.close();process.send({type:'done',result,beginCalls,reserveCalls,elapsedMs:Date.now()-start});process.disconnect();return;
    }
    if(input.mode==='hold'||input.mode==='bump'){
      let result='committed';const start=Date.now();try{journal.transact(scope,s=>{mutations++;if(input.notice){fs.writeFileSync(input.notice,'lock-held',{flag:'wx'});pause(input.holdMs);}return advance(s);});}catch(e){result='busy-refused';assert.equal(mutations,0);assert.equal(e.errcode,5);}
      journal.close();process.send({type:'done',result,mutations,elapsedMs:Date.now()-start});process.disconnect();return;
    }
    if(input.mode==='inspect'){const state=journal.inspect();journal.close();process.send({type:'done',state});process.disconnect();return;}
    throw Error('Unknown child mode');
  }catch(e){try{journal.close();}catch{}throw e;}
}

async function main(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'omerta-wallet-journal-test-'));fs.chmodSync(directory,0o700);
  let positives=0,refusals=0,network=0,sqliteVersion;const results=[],children=new Set(),childReceipts=[],handles=new Set(),unavailable=[];
  const savedFetch=globalThis.fetch;globalThis.fetch=()=>{network++;throw Error('Network forbidden');};
  const file=name=>path.join(directory,name+'.sqlite');
  const create=async name=>{const h=await createWalletComputeJournal({enabled:true,path:file(name),initialState:initial()});handles.add(h);return h;};
  const open=async name=>{const h=await openWalletComputeJournal(config(file(name)));handles.add(h);return h;};
  const yes=async(name,fn)=>{await fn();positives++;results.push({name,status:'PASS'});};
  const no=async(name,fn)=>{await fn();refusals++;results.push({name,status:'REFUSED'});};
  function launch(input){
    const child=fork(SELF,['--journal-child',JSON.stringify(input)],{stdio:['ignore','pipe','pipe','ipc'],execArgv:[],windowsHide:true});children.add(child);
    const messages=[],waiters=[];let out='',err='',error=null,stdoutClosed=false,stderrClosed=false;
    child.stdout.on('data',b=>{out+=b;assert(out.length<=65536);});child.stderr.on('data',b=>{err+=b;assert(err.length<=65536);});child.stdout.on('close',()=>{stdoutClosed=true;});child.stderr.on('close',()=>{stderrClosed=true;});child.on('error',e=>{error=e.code;});
    child.on('message',m=>{messages.push(m);for(const w of [...waiters])if(w.type===m.type){clearTimeout(w.timer);waiters.splice(waiters.indexOf(w),1);w.resolve(m);}});
    const terminal=new Promise(resolve=>child.once('close',(code,signal)=>{children.delete(child);const row={mode:input.mode,code,signal,error,stdoutClosed,stderrClosed,messages,stdout:out,stderr:err};childReceipts.push(row);resolve(row);}));
    const wait=type=>{const prior=messages.find(m=>m.type===type);if(prior)return Promise.resolve(prior);return new Promise((resolve,reject)=>{const w={type,resolve,timer:setTimeout(()=>reject(Error('Child '+input.mode+' missing '+type)),8000)};waiters.push(w);});};
    const finish=async(expectedKill=false)=>{let timer;try{const r=await Promise.race([terminal,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Child did not close')),8000);})]);assert.equal(r.error,null);assert(r.stdoutClosed&&r.stderrClosed);if(!expectedKill)assert.equal(r.code,0);else assert(r.code!==0||r.signal!==null);return r;}finally{clearTimeout(timer);}};
    return{child,wait,finish,go:()=>child.send({type:'go'})};
  }
  async function notice(p){const start=Date.now();while(!fs.existsSync(p)){assert(Date.now()-start<5000,'Lock notification deadline');await sleep(10);}}
  try{
    await yes('Explicit create, verified SQLite DELETE/EXTRA and durable close/reopen/new-process state',async()=>{
      const h=await create('persistent');assert.equal(h.version,1);assert.equal(h.atomic,true);assert.equal(h.durable,true);assert.deepEqual(h.inspect(),initial());
      const r=h.transact(scope,s=>advance(s));assert.equal(r.committed,true);assert.equal(r.durable,true);assert.equal(r.state.revision,1);h.close();assert.equal(h.closed,true);h.close();
      const other=await open('persistent');assert.deepEqual(other.inspect(),r.state);other.close();
      const c=launch({mode:'inspect',file:file('persistent')});await c.wait('ready');c.go();const row=await c.wait('done');assert.deepEqual(row.state,r.state);await c.finish();
      const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(file('persistent'),{allowExtension:false});sqliteVersion=db.prepare('SELECT sqlite_version() AS version').get().version;assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode,'delete');db.close();
    });
    await no('Missing storage never initializes itself and create never overwrites an existing journal',async()=>{await assert.rejects(openWalletComputeJournal(config(file('missing'))),e=>e.code==='ENOENT');assert.equal(fs.existsSync(file('missing')),false);const bytes=fs.readFileSync(file('persistent'));await assert.rejects(createWalletComputeJournal({enabled:true,path:file('persistent'),initialState:initial()}),e=>e.code==='EEXIST');assert(fs.readFileSync(file('persistent')).equals(bytes));});
    for(const p of [':memory:','file:journal?mode=memory','relative.sqlite',path.join(directory,'x?mode=memory'),path.join(directory,'x#fragment')])await no('Memory, URI, relative and query-like paths refuse',async()=>{await assert.rejects(openWalletComputeJournal({...config(p),path:p}));});
    await no('Explicit opt-in and bounded busy timeout are mandatory',async()=>{for(const overrides of [{enabled:false},{busyTimeoutMs:0},{busyTimeoutMs:5001},{busyTimeoutMs:1.5},{extra:true}])await assert.rejects(openWalletComputeJournal({...config(file('persistent')),...overrides}));});
    await no('Create requires an exact fresh empty state',async()=>{for(const change of [s=>s.revision=1,s=>s.lastNowMs=NOW,s=>s.extra=true]){const s=structuredClone(initial());change(s);await assert.rejects(createWalletComputeJournal({enabled:true,path:file('bad-initial'),initialState:s}));assert.equal(fs.existsSync(file('bad-initial')),false);}});
    await no('Unknown wallet scope and policy refuse without resetting real state',async()=>{const bytes=fs.readFileSync(file('persistent'));for(const extra of [{scope:{...scope,wallet:PAYEE.toLowerCase()}},{policyDigest:'0'.repeat(64)},{scope:{...scope,network:'eip155:1'}}])await assert.rejects(openWalletComputeJournal({...config(file('persistent')),...extra}));assert(fs.readFileSync(file('persistent')).equals(bytes));});
    await no('Nonregular files and parent junctions/symlinks refuse',async()=>{
      const folder=file('folder');fs.mkdirSync(folder);await assert.rejects(openWalletComputeJournal(config(folder)),e=>e.code==='JOURNAL_PATH_NOT_REGULAR');
      const target=path.join(directory,'real-parent'),link=path.join(directory,'linked-parent');fs.mkdirSync(target,{mode:0o700});fs.symlinkSync(target,link,process.platform==='win32'?'junction':'dir');await assert.rejects(createWalletComputeJournal({enabled:true,path:path.join(link,'journal.sqlite'),initialState:initial()}),e=>e.code==='JOURNAL_PARENT_SYMLINK_OR_TYPE');
      try{const linked=file('file-symlink');fs.symlinkSync(file('persistent'),linked,'file');await assert.rejects(openWalletComputeJournal(config(linked)));}catch(e){if(e.code==='EPERM')unavailable.push('File symlink creation requires OS privilege; actual parent junction test passed.');else throw e;}
    });
    await no('Hard-linked database and unexpected WAL/SHM or symlink rollback sidecars refuse',async()=>{
      const linked=file('hardlink');fs.linkSync(file('persistent'),linked);await assert.rejects(openWalletComputeJournal(config(linked)));fs.unlinkSync(linked);
      for(const suffix of ['-wal','-shm']){const p=file('persistent')+suffix;fs.writeFileSync(p,'unexpected',{mode:0o600});await assert.rejects(openWalletComputeJournal(config(file('persistent'))));fs.unlinkSync(p);}
      try{const p=file('persistent')+'-journal';fs.symlinkSync(path.join(directory,'missing-sidecar-target'),p,'file');await assert.rejects(openWalletComputeJournal(config(file('persistent'))));fs.unlinkSync(p);}catch(e){if(e.code==='EPERM')unavailable.push('Rollback-file symlink creation requires OS privilege; dangling symlink source check remains unexecuted on this OS.');else throw e;}
    });
    if(process.platform==='win32'){fs.accessSync(file('persistent'),fs.constants.R_OK|fs.constants.W_OK);unavailable.push('Windows DACL exclusivity is trusted, not certified by Node POSIX mode bits. Actual process R/W access is checked; POSIX-mode refusal test not applicable.');}
    else await no('Private POSIX modes are enforced',async()=>{fs.chmodSync(file('persistent'),0o644);await assert.rejects(openWalletComputeJournal(config(file('persistent'))),e=>e.code==='JOURNAL_PRIVATE_PERMISSIONS_REQUIRED');fs.chmodSync(file('persistent'),0o600);});
    const {DatabaseSync}=await import('node:sqlite');
    for(const mutation of ['not-sqlite','corrupt','schema','profile','checksum','mode','missing-row'])await no('Corrupt or unexpected '+mutation+' refuses open',async()=>{
      const p=file('bad-'+mutation);fs.copyFileSync(file('persistent'),p);
      if(mutation==='not-sqlite')fs.writeFileSync(p,'not a database');
      else if(mutation==='corrupt')fs.writeFileSync(p,Buffer.concat([Buffer.from('SQLite format 3\0'),Buffer.alloc(200,0xff)]));
      else{const db=new DatabaseSync(p,{allowExtension:false});if(mutation==='schema')db.exec('CREATE TABLE extra (id INTEGER);');if(mutation==='profile')db.exec('PRAGMA application_id=7;');if(mutation==='checksum')db.exec("UPDATE wallet_compute_journal SET checksum='"+'0'.repeat(64)+"';");if(mutation==='mode')db.exec('PRAGMA journal_mode=WAL;');if(mutation==='missing-row')db.exec('DELETE FROM wallet_compute_journal;');db.close();}
      await assert.rejects(openWalletComputeJournal(config(p)));
    });
    await yes('Two actual handles observe serialized latest state with exactly one mutator invocation',async()=>{const a=await create('handles'),b=await open('handles');let ac=0,bc=0;assert.equal(a.transact(scope,s=>{ac++;return advance(s);}).state.revision,1);assert.equal(b.transact(scope,s=>{bc++;assert.equal(s.revision,1);return advance(s);}).state.revision,2);assert.equal(a.inspect().revision,2);assert.equal(ac,1);assert.equal(bc,1);a.close();b.close();});
    await no('Mutator throws or async results roll back without retry or durable receipt',async()=>{const h=await create('rollback'),before=h.inspect();let calls=0;const boom=Error('mutator failure');assert.throws(()=>h.transact(scope,s=>{calls++;s.revision++;throw boom;}),e=>e===boom);assert.equal(calls,1);assert.deepEqual(h.inspect(),before);for(const fn of [async s=>advance(s),async()=>{throw Error('async rejection');},()=>({then(){throw Error('thenable must not execute');}})]){assert.throws(()=>h.transact(scope,fn));assert.deepEqual(h.inspect(),before);}await sleep(0);h.close();});
    await no('Scope/reentrancy/closed handles refuse before nested mutation',async()=>{const h=await create('boundaries');let calls=0;assert.throws(()=>h.transact({...scope,wallet:PAYEE.toLowerCase()},s=>{calls++;return advance(s);}));assert.equal(calls,0);assert.throws(()=>h.transact(scope,s=>{calls++;h.transact(scope,x=>advance(x));return advance(s);}),e=>e.code==='JOURNAL_REENTRANT');assert.equal(calls,1);assert.equal(h.inspect().revision,0);h.close();assert.throws(()=>h.inspect(),e=>e.code==='JOURNAL_CLOSED');assert.throws(()=>h.transact(scope,s=>advance(s)),e=>e.code==='JOURNAL_CLOSED');});
    await no('State revisions, holds, history, clock, data shape and nonce identity cannot regress',async()=>{
      const h=await create('state-guards');h.transact(scope,s=>quoteEntry(s,'attempt_0001'));h.transact(scope,s=>reserveEntry(s,'attempt_0001'));const before=h.inspect();
      const changes=[s=>s.revision++,s=>s.lastNowMs=before.lastNowMs-1,s=>s.attempts=[],s=>s.attempts[0].amountAtoms='0',s=>s.attempts[0].url='https://other.invalid/',s=>s.attempts[0].state='quoting',s=>s.policyDigest='0'.repeat(64),s=>s.extra=true,s=>s.attempts[0].updatedAtMs=1,s=>s.attempts.push({...s.attempts[0],id:'attempt_0002'}),s=>s.attempts.foo='extra',s=>s.attempts[0].bodyDigest='not-hash',s=>s.attempts[0].model='x'.repeat(16385)];
      for(const change of changes){assert.throws(()=>h.transact(scope,s=>advance(s,change)));assert.deepEqual(h.inspect(),before);}h.close();
    });
    await yes('Real competing processes serialize under BEGIN IMMEDIATE and cannot oversubscribe a held budget',async()=>{
      (await create('processes')).close();const noticePath=path.join(directory,'compete-lock'),a=launch({mode:'compete',file:file('processes'),id:'process_0001',notice:noticePath,holdMs:700}),b=launch({mode:'compete',file:file('processes'),id:'process_0002'});
      await Promise.all([a.wait('ready'),b.wait('ready')]);a.go();await notice(noticePath);b.go();const rows=await Promise.all([a.wait('done'),b.wait('done')]);await Promise.all([a.finish(),b.finish()]);assert.deepEqual(rows.map(r=>r.result).sort(),['budget-refused','held']);for(const r of rows){assert.equal(r.beginCalls,1);assert.equal(r.reserveCalls,1);}const h=await open('processes');assert.equal(h.inspect().attempts.reduce((n,e)=>n+BigInt(e.amountAtoms),0n),1n);assert.equal(h.inspect().revision,3);h.close();
    });
    await no('Bounded SQLite busy wait does not invoke or retry the losing mutator',async()=>{
      (await create('busy')).close();const noticePath=path.join(directory,'busy-lock'),a=launch({mode:'hold',file:file('busy'),notice:noticePath,holdMs:1000}),b=launch({mode:'bump',file:file('busy'),busy:100});await Promise.all([a.wait('ready'),b.wait('ready')]);a.go();await notice(noticePath);b.go();const loser=await b.wait('done');assert.equal(loser.result,'busy-refused');assert.equal(loser.mutations,0);assert(loser.elapsedMs<1500);await b.finish();assert.equal((await a.wait('done')).mutations,1);await a.finish();const h=await open('busy');assert.equal(h.inspect().revision,1);h.close();
    });
    await yes('Killed adapter before commit preserves the exact prior committed state',async()=>{
      const h=await create('kill-before');h.transact(scope,s=>quoteEntry(s,'attempt_0001'));h.transact(scope,s=>reserveEntry(s,'attempt_0001'));const before=h.inspect();h.close();const c=launch({mode:'before-commit',file:file('kill-before')});await c.wait('ready');c.go();assert.equal((await c.wait('before-commit')).mutations,1);c.child.kill('SIGKILL');await c.finish(true);const after=await open('kill-before');assert.deepEqual(after.inspect(),before);after.close();
    });
    await yes('Actual uncommitted SQLite write and hot rollback journal recover after writer termination',async()=>{
      const h=await create('kill-hot');h.transact(scope,s=>advance(s));const before=h.inspect();h.close();const c=launch({mode:'hot-write',file:file('kill-hot')});await c.wait('hot-write-ready');c.child.kill('SIGKILL');await c.finish(true);const reopened=await open('kill-hot');assert.deepEqual(reopened.inspect(),before);reopened.close();
    });
    await yes('Killed process after confirmed EXTRA commit retains the exact new state on reopen',async()=>{
      (await create('kill-after')).close();const c=launch({mode:'after-commit',file:file('kill-after')});await c.wait('ready');c.go();const committed=await c.wait('after-commit');assert(committed.committed&&committed.durable);c.child.kill('SIGKILL');await c.finish(true);const h=await open('kill-after');assert.deepEqual(h.inspect(),committed.state);h.close();
    });
    await no('Live handles reject valid old revision rollback; file replacement is blocked by OS or identity guard',async()=>{
      const h=await create('rollback-detection'),first=new DatabaseSync(file('rollback-detection'),{allowExtension:false}),oldRow=first.prepare('SELECT revision,state_json,checksum FROM wallet_compute_journal').get();first.close();h.transact(scope,s=>advance(s));const snapshot=h.inspect(),raw=new DatabaseSync(file('rollback-detection'),{allowExtension:false});raw.prepare('UPDATE wallet_compute_journal SET revision=?,state_json=?,checksum=?').run(oldRow.revision,oldRow.state_json,oldRow.checksum);raw.close();assert.throws(()=>h.inspect(),e=>e.code==='JOURNAL_ROLLBACK_DETECTED');h.close();assert.equal(snapshot.revision,1);
      const p=file('replace');const r=await create('replace');r.close();const live=await open('replace');try{fs.renameSync(p,p+'.old');fs.copyFileSync(file('persistent'),p);assert.throws(()=>live.inspect(),e=>e.code==='JOURNAL_FILE_IDENTITY_CHANGED');}catch(e){if(['EPERM','EBUSY','EACCES'].includes(e.code))unavailable.push('OS prevented replacement of an open database; source identity rejection retained.');else throw e;}live.close();
    });
    await yes('Reviewed client uses two real SQLite handles to enforce one budget without any live operation',async()=>{
      const a=await create('client'),b=await open('client');let fetches=0,signatures=0;
      const signature='0x12d17a1f9e93bfe5e91ae99c0f1a1b94a0a27762b7ac17b9e604dee3a34a466b6ca49fbc5e1bb25d1851d8eee9b025b36b85d81111e41d1b2312e6fdf57e2b7c1b';
      const make=j=>createWalletComputeClient({enabled:true,walletAddress:WALLET,policy:policy(),journal:j,signer:{address:WALLET,signTypedData(){signatures++;return signature;}},authorize:p=>({approved:true,approvalDigest:p.approvalDigest}),now:()=>NOW,randomBytes:()=>Buffer.alloc(32,0xa1),fetchImpl:(url,r)=>{fetches++;if(!r.headers['PAYMENT-SIGNATURE'])return new Response('{}',{status:402,headers:{'PAYMENT-REQUIRED':Buffer.from(JSON.stringify({x402Version:2,resource:{url:URL},accepts:[{scheme:'exact',network:scope.network,amount:'1',asset:WALLET_COMPUTE_USDC,payTo:PAYEE,maxTimeoutSeconds:300,extra:{name:'USD Coin',version:'2'}}]})).toString('base64')}});return new Response('{"choices":[]}',{status:200,headers:{'PAYMENT-RESPONSE':Buffer.from(JSON.stringify({success:true,transaction:'0x'+'aa'.repeat(32),network:scope.network})).toString('base64')}});}});
      const request=(id,content)=>({attemptId:id,resourceUrl:URL,body:{model:MODEL,messages:[{role:'user',content}],max_tokens:1,stream:false}});
      const results=await Promise.all([make(a).compute(request('client_00001','one')),make(b).compute(request('client_00002','two'))]);assert.equal(results.filter(x=>x.state==='response').length,1);assert.equal(results.filter(x=>x.error?.code==='DAILY_BUDGET_OR_PENDING_HOLDS').length,1);assert.equal(fetches,3);assert.equal(signatures,1);assert.equal(a.inspect().attempts.reduce((n,e)=>n+BigInt(e.amountAtoms),0n),1n);assert(results.every(x=>x.settlementVerified===false));a.close();b.close();
    });
    assert.equal(children.size,0);assert.equal(network,0);
    console.log('wallet-compute-journal evidence '+JSON.stringify({cases:results,children:childReceipts}));
    console.log('wallet-compute-journal PASS '+JSON.stringify({positives,refusals,checks:results.length,sqliteVersion,node:process.version,childProcesses:childReceipts.length,normalChildren:childReceipts.filter(x=>x.code===0).length,intentionallyKilledChildren:childReceipts.filter(x=>x.code!==0).length,allChildStreamsClosed:childReceipts.every(x=>x.stdoutClosed&&x.stderrClosed),network:0,liveSignatures:0,transactionsOnChain:0,unavailable,scope:'Actual local SQLite DELETE/EXTRA, filesystem and child-process tests; no hardware power-loss, hostile-owner rollback, Windows DACL exclusivity or NFS durability certification.'}));
  }finally{
    globalThis.fetch=savedFetch;
    for(const c of children)c.kill('SIGKILL');if(children.size){let timer;try{await Promise.race([Promise.all([...children].map(c=>new Promise(resolve=>c.once('close',resolve)))),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned child cleanup did not close; temporary evidence retained at '+directory)),8000);})]);}finally{clearTimeout(timer);}}
    for(const h of handles)try{h.close();}catch{}
    const actual=fs.realpathSync(directory),root=fs.realpathSync(os.tmpdir());assert.equal(path.dirname(actual),root);assert(/^omerta-wallet-journal-test-[\w-]+$/.test(path.basename(actual)));assert(!fs.lstatSync(actual).isSymbolicLink());fs.rmSync(actual,{recursive:true,force:false});
  }
}

if(process.argv[2]==='--journal-child')await childMain(JSON.parse(process.argv[3]));else await main();
