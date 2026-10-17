// Opt-in local-disk SQLite adapter. No wallet, network, environment or automatic initialization.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {WALLET_COMPUTE_NETWORK,WALLET_COMPUTE_USDC} from './wallet-compute-client.js';

const PROFILE='wallet-compute-journal-v1',APP_ID=0x57434a31;
const MAX_JSON=1048576,MAX_FILE=8388608,MAX_REVISION=Number.MAX_SAFE_INTEGER-1;
const TABLE_SQL=`CREATE TABLE wallet_compute_journal (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  profile TEXT NOT NULL CHECK (profile = 'wallet-compute-journal-v1'),
  scope_json TEXT NOT NULL,
  policy_digest TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  state_json TEXT NOT NULL CHECK (length(state_json) <= 1048576),
  checksum TEXT NOT NULL CHECK (length(checksum) = 64)
) STRICT`;
const ENTRY=['id','url','model','requestDigest','bodyDigest','startedAtMs','updatedAtMs','dayUTC','state','amountAtoms','merchant','quoteDigest','typedDataHash','nonceHash','validAfter','validBefore','signatureHash'];
const TRANSITIONS={quoting:['quoting','reserved','refused'],refused:['refused'],reserved:['reserved','authorized','ambiguous'],authorized:['authorized','response','ambiguous'],response:['response','ambiguous'],ambiguous:['ambiguous']};
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value);
const clone=value=>structuredClone(value);
function fail(code){const e=new Error(code);e.code=code;throw e;}
function check(ok,code='INVALID_JOURNAL_INPUT'){if(!ok)fail(code);}
function object(value,keys,optional=[]){
  check(value&&typeof value==='object'&&!Array.isArray(value));
  check([Object.prototype,null].includes(Object.getPrototypeOf(value)));
  const d=Object.getOwnPropertyDescriptors(value);
  check(Reflect.ownKeys(value).every(k=>typeof k==='string'&&Object.hasOwn(d[k],'value')));
  check(keys.every(k=>Object.hasOwn(value,k))&&Object.keys(value).every(k=>keys.includes(k)||optional.includes(k)));
}
function integer(n,min,max){check(Number.isSafeInteger(n)&&n>=min&&n<=max,'INVALID_JOURNAL_STATE');}
function digest(s){check(typeof s==='string'&&/^[a-f0-9]{64}$/.test(s),'INVALID_JOURNAL_STATE');}
function amount(s,zero=false){check(typeof s==='string'&&/^(0|[1-9]\d{0,77})$/.test(s),'INVALID_JOURNAL_STATE');const n=BigInt(s);check(n<1n<<256n&&(zero?n>=0n:n>0n),'INVALID_JOURNAL_STATE');return n;}
function scopeInput(scope){
  object(scope,['version','wallet','network','asset']);
  check(scope.version===1&&typeof scope.wallet==='string'&&/^0x[a-f0-9]{40}$/.test(scope.wallet)&&scope.network===WALLET_COMPUTE_NETWORK&&scope.asset===WALLET_COMPUTE_USDC.toLowerCase(),'JOURNAL_SCOPE_MISMATCH');
  return clone(scope);
}
function json(value){
  let nodes=0;const seen=new Set();
  const visit=(item,depth)=>{
    check(++nodes<=30000&&depth<=12,'JOURNAL_STATE_TOO_COMPLEX');
    if(item===null||typeof item==='boolean')return;
    if(typeof item==='number'){check(Number.isFinite(item),'INVALID_JOURNAL_STATE');return;}
    if(typeof item==='string'){check(item.length<=16384,'JOURNAL_STATE_TOO_LARGE');return;}
    check(item&&typeof item==='object'&&!seen.has(item),'INVALID_JOURNAL_STATE');seen.add(item);
    if(Array.isArray(item)){check(Object.getPrototypeOf(item)===Array.prototype&&item.length<=1000,'JOURNAL_STATE_TOO_COMPLEX');const d=Object.getOwnPropertyDescriptors(item);check(Reflect.ownKeys(item).length===item.length+1&&Reflect.ownKeys(item).every(k=>typeof k==='string'&&Object.hasOwn(d[k],'value')&&(k==='length'||/^(0|[1-9]\d*)$/.test(k))),'INVALID_JOURNAL_STATE');for(const child of item)visit(child,depth+1);}
    else{object(item,[],Object.keys(item));check(Object.keys(item).length<=32,'JOURNAL_STATE_TOO_COMPLEX');for(const child of Object.values(item))visit(child,depth+1);}
    seen.delete(item);
  };
  visit(value,0);const result=canonical(value);check(Buffer.byteLength(result)<=MAX_JSON,'JOURNAL_STATE_TOO_LARGE');return result;
}
function validateState(state,scope,policyDigest){
  json(state);object(state,['version','scope','policyDigest','revision','lastNowMs','attempts']);
  check(state.version===1&&canonical(scopeInput(state.scope))===canonical(scope)&&state.policyDigest===policyDigest,'JOURNAL_SCOPE_OR_POLICY_MISMATCH');
  integer(state.revision,0,MAX_REVISION);integer(state.lastNowMs,0,8640000000000000);check(Array.isArray(state.attempts)&&state.attempts.length<=1000,'INVALID_JOURNAL_STATE');
  const ids=new Set(),nonces=new Set();
  for(const e of state.attempts){
    object(e,ENTRY);check(typeof e.id==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(e.id)&&!ids.has(e.id),'INVALID_JOURNAL_STATE');ids.add(e.id);
    check(typeof e.url==='string'&&e.url.length<=2048,'INVALID_JOURNAL_STATE');let u;try{u=new URL(e.url);}catch{fail('INVALID_JOURNAL_STATE');}
    check(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&!u.search&&u.href===e.url,'INVALID_JOURNAL_STATE');
    check(typeof e.model==='string'&&/^[\w./:-]{1,128}$/.test(e.model),'INVALID_JOURNAL_STATE');digest(e.requestDigest);digest(e.bodyDigest);
    integer(e.startedAtMs,1,state.lastNowMs);integer(e.updatedAtMs,e.startedAtMs,state.lastNowMs);check(e.dayUTC===new Date(e.startedAtMs).toISOString().slice(0,10),'INVALID_JOURNAL_STATE');
    check(Object.hasOwn(TRANSITIONS,e.state),'INVALID_JOURNAL_STATE');const atoms=amount(e.amountAtoms,true);
    if(atoms===0n){check(['quoting','refused'].includes(e.state),'INVALID_JOURNAL_STATE');for(const key of ['merchant','quoteDigest','typedDataHash','nonceHash','validAfter','validBefore','signatureHash'])check(e[key]===null,'INVALID_JOURNAL_STATE');}
    else{
      check(['reserved','authorized','ambiguous','response'].includes(e.state)&&/^0x[a-f0-9]{40}$/.test(e.merchant),'INVALID_JOURNAL_STATE');
      for(const key of ['quoteDigest','typedDataHash','nonceHash'])digest(e[key]);check(!nonces.has(e.nonceHash),'JOURNAL_NONCE_REUSED');nonces.add(e.nonceHash);
      amount(e.validAfter,true);amount(e.validBefore);check(BigInt(e.validBefore)>BigInt(e.validAfter),'INVALID_JOURNAL_STATE');
      if(e.signatureHash!==null)digest(e.signatureHash);if(['authorized','response'].includes(e.state))check(e.signatureHash!==null,'INVALID_JOURNAL_STATE');
    }
  }
}
function validateNext(before,next,scope,policyDigest){
  validateState(next,scope,policyDigest);check(next.revision===before.revision+1&&next.lastNowMs>=before.lastNowMs,'JOURNAL_REVISION_OR_CLOCK');
  check(next.attempts.length>=before.attempts.length&&next.attempts.length<=before.attempts.length+1,'JOURNAL_HISTORY_REMOVAL');
  for(let i=0;i<before.attempts.length;i++){
    const a=before.attempts[i],b=next.attempts[i];
    for(const key of ['id','url','model','requestDigest','bodyDigest','startedAtMs','dayUTC'])check(a[key]===b[key],'JOURNAL_HISTORY_CHANGED');
    check(TRANSITIONS[a.state].includes(b.state)&&b.updatedAtMs>=a.updatedAtMs,'JOURNAL_STATE_REGRESSION');
    if(amount(a.amountAtoms,true)>0n)for(const key of ['amountAtoms','merchant','quoteDigest','typedDataHash','nonceHash','validAfter','validBefore'])check(a[key]===b[key],'JOURNAL_HOLD_CHANGED');
    if(a.signatureHash!==null)check(b.signatureHash===a.signatureHash,'JOURNAL_SIGNATURE_CHANGED');
  }
  for(const e of next.attempts.slice(before.attempts.length))check(e.state==='quoting'&&e.amountAtoms==='0','JOURNAL_NEW_ATTEMPT_INVALID');
}
function runtime(){const [major,minor]=process.versions.node.split('.').map(Number);check(major>22||(major===22&&minor>=16),'NODE_22_16_SQLITE_REQUIRED');}
function identity(stat){return [stat.dev,stat.ino,stat.birthtimeNs,stat.uid].map(String).join(':');}
function permissions(stat,isDirectory){
  check(isDirectory?stat.isDirectory():stat.isFile(),'JOURNAL_PATH_NOT_REGULAR');check(!stat.isSymbolicLink(),'JOURNAL_SYMLINK_REFUSED');
  if(!isDirectory)check(stat.nlink===1n,'JOURNAL_HARDLINK_REFUSED');
  if(process.platform!=='win32'){check(stat.uid===BigInt(process.getuid()),'JOURNAL_OWNER_MISMATCH');check((stat.mode&0o077n)===0n,'JOURNAL_PRIVATE_PERMISSIONS_REQUIRED');}
}
function pathInput(value){
  check(typeof value==='string'&&value.length<=4096&&!value.includes('\0')&&path.isAbsolute(value)&&!value.startsWith('\\\\')&&!value.startsWith('//')&&!/^file:/i.test(value),'JOURNAL_ABSOLUTE_LOCAL_PATH_REQUIRED');
  const file=path.normalize(value);check(path.basename(file)!==':memory:'&&path.basename(file)!=='.'&&!/[?#]/.test(file),'JOURNAL_ABSOLUTE_LOCAL_PATH_REQUIRED');
  const parent=path.dirname(file),ancestors=[];let current=parent;
  for(;;){const stat=fs.lstatSync(current,{bigint:true});check(stat.isDirectory()&&!stat.isSymbolicLink(),'JOURNAL_PARENT_SYMLINK_OR_TYPE');ancestors.push({path:current,identity:identity(stat)});const up=path.dirname(current);if(up===current)break;current=up;}
  permissions(fs.lstatSync(parent,{bigint:true}),true);fs.accessSync(parent,fs.constants.R_OK|fs.constants.W_OK|fs.constants.X_OK);return{file,parent,ancestors};
}
function fileGuard(location,fd){
  const original=identity(fs.fstatSync(fd,{bigint:true}));
  return()=>{
    for(const a of location.ancestors){const s=fs.lstatSync(a.path,{bigint:true});check(s.isDirectory()&&!s.isSymbolicLink()&&identity(s)===a.identity,'JOURNAL_PARENT_IDENTITY_CHANGED');}
    permissions(fs.lstatSync(location.parent,{bigint:true}),true);
    const stat=fs.lstatSync(location.file,{bigint:true}),held=fs.fstatSync(fd,{bigint:true});permissions(stat,false);
    check(identity(stat)===original&&identity(held)===original&&stat.size<=BigInt(MAX_FILE),'JOURNAL_FILE_IDENTITY_CHANGED');fs.accessSync(location.file,fs.constants.R_OK|fs.constants.W_OK);
    for(const suffix of ['-journal','-wal','-shm']){const p=location.file+suffix;let s;try{s=fs.lstatSync(p,{bigint:true});}catch(e){if(e.code==='ENOENT')continue;throw e;}check(suffix==='-journal','JOURNAL_UNEXPECTED_SIDECAR');permissions(s,false);check(s.size<=BigInt(MAX_FILE),'JOURNAL_SIDECAR_TOO_LARGE');}
  };
}
function pragma(db,name){const row=db.prepare('PRAGMA '+name).get();return Object.values(row)[0];}
function settings(db,busy){
  check(pragma(db,'main.journal_mode')==='delete'&&pragma(db,'main.synchronous')===3&&pragma(db,'busy_timeout')===busy&&pragma(db,'trusted_schema')===0,'JOURNAL_DURABILITY_PROFILE_CHANGED');
}
function schema(db){
  check(pragma(db,'application_id')===APP_ID&&pragma(db,'user_version')===1,'JOURNAL_PROFILE_MISMATCH');
  const rows=db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_schema ORDER BY name').all();
  check(rows.length===1&&rows[0].type==='table'&&rows[0].name==='wallet_compute_journal'&&rows[0].tbl_name==='wallet_compute_journal'&&rows[0].sql===TABLE_SQL,'JOURNAL_SCHEMA_MISMATCH');
}
function rowFor(state,scope,policyDigest){const scopeJSON=canonical(scope),stateJSON=json(state),revision=state.revision;return{scopeJSON,policyDigest,revision,stateJSON,checksum:hash(canonical({profile:PROFILE,scopeJSON,policyDigest,revision,stateJSON}))};}
function readState(db,scope,policyDigest){
  schema(db);const rows=db.prepare('SELECT * FROM main.wallet_compute_journal ORDER BY singleton LIMIT 2').all();check(rows.length===1,'JOURNAL_ROW_MISSING_OR_EXTRA');const row=rows[0];
  check(row.singleton===1&&row.profile===PROFILE&&typeof row.state_json==='string'&&Buffer.byteLength(row.state_json)<=MAX_JSON,'JOURNAL_ROW_INVALID');let state;
  try{state=JSON.parse(row.state_json);}catch{fail('JOURNAL_JSON_CORRUPT');}validateState(state,scope,policyDigest);
  const expected=rowFor(state,scope,policyDigest);check(row.scope_json===expected.scopeJSON&&row.policy_digest===policyDigest&&row.revision===expected.revision&&row.state_json===expected.stateJSON&&row.checksum===expected.checksum,'JOURNAL_CHECKSUM_OR_ROW_MISMATCH');return state;
}

/** Local disk and private Windows ACLs are caller/OS responsibilities. POSIX owner/private modes,
 * actual process R/W access and path identities are checked. SQLite EXTRA depends on the VFS,
 * filesystem and storage honoring sync; these tests cannot certify hardware power-loss behavior.
 * An owner/admin can create another file or restore an old backup: no anti-rollback claim is made.
 * Mutators must be trusted synchronous, bounded, side-effect-free client updates, never signing/IO.
 */
async function connect(input,create){
  object(input,create?['enabled','path','initialState']:['enabled','path','scope','policyDigest'],['busyTimeoutMs']);check(input.enabled===true,'JOURNAL_NOT_OPTED_IN');runtime();
  const busy=input.busyTimeoutMs??2000;check(Number.isSafeInteger(busy)&&busy>=1&&busy<=5000,'JOURNAL_BUSY_TIMEOUT_INVALID');
  const initial=create?clone(input.initialState):null,scope=scopeInput(create?initial.scope:input.scope),policyDigest=create?initial.policyDigest:input.policyDigest;digest(policyDigest);
  if(create){validateState(initial,scope,policyDigest);check(initial.revision===0&&initial.lastNowMs===0&&initial.attempts.length===0,'JOURNAL_CREATE_FRESH_ONLY');}
  let DatabaseSync;try{({DatabaseSync}=await import('node:sqlite'));check(typeof DatabaseSync==='function','NODE_SQLITE_UNAVAILABLE');}catch{fail('NODE_SQLITE_UNAVAILABLE');}
  const location=pathInput(input.path);let fd,db;
  try{
    // Refuse devices/FIFOs before open(), which could otherwise block on a nonregular file.
    if(!create)permissions(fs.lstatSync(location.file,{bigint:true}),false);
    fd=fs.openSync(location.file,fs.constants.O_RDWR|(create?fs.constants.O_CREAT|fs.constants.O_EXCL:0)|(fs.constants.O_NOFOLLOW??0),0o600);
    const guard=fileGuard(location,fd);guard();
    if(!create){const header=Buffer.alloc(16);check(fs.readSync(fd,header,0,16,0)===16&&header.equals(Buffer.from('SQLite format 3\0')),'JOURNAL_NOT_SQLITE');}
    db=new DatabaseSync(location.file,{allowExtension:false,enableDoubleQuotedStringLiterals:false,enableForeignKeyConstraints:true,timeout:busy});db.enableLoadExtension(false);guard();
    check(pragma(db,'main.journal_mode')==='delete','JOURNAL_UNEXPECTED_MODE');
    db.exec('PRAGMA synchronous=EXTRA; PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON; PRAGMA cell_size_check=ON;');settings(db,busy);
    if(create){
      db.exec('BEGIN IMMEDIATE');try{db.exec('PRAGMA application_id='+APP_ID+'; PRAGMA user_version=1; '+TABLE_SQL+';');const row=rowFor(initial,scope,policyDigest);db.prepare('INSERT INTO main.wallet_compute_journal VALUES (1,?,?,?,?,?,?)').run(PROFILE,row.scopeJSON,row.policyDigest,row.revision,row.stateJSON,row.checksum);guard();db.exec('COMMIT');}catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}
    }
    check(pragma(db,'quick_check(1)')==='ok','JOURNAL_DATABASE_CORRUPT');
    db.exec('BEGIN');try{guard();settings(db,busy);readState(db,scope,policyDigest);db.exec('COMMIT');}catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}guard();
    let closed=false,active=false,faulted=false,lastSeen=readState(db,scope,policyDigest);
    const ready=()=>{check(!closed,'JOURNAL_CLOSED');check(!faulted,'JOURNAL_FAULTED');check(!active,'JOURNAL_REENTRANT');guard();};
    const monotonic=state=>{check(state.revision>=lastSeen.revision,'JOURNAL_ROLLBACK_DETECTED');if(state.revision===lastSeen.revision)check(canonical(state)===canonical(lastSeen),'JOURNAL_REVISION_REUSED');};
    const adapter={version:1,atomic:true,durable:true,
      transact(givenScope,update){
        ready();check(canonical(scopeInput(givenScope))===canonical(scope),'JOURNAL_SCOPE_MISMATCH');check(typeof update==='function','JOURNAL_MUTATOR_REQUIRED');active=true;let begun=false,commitStarted=false;
        try{
          db.exec('BEGIN IMMEDIATE');begun=true;guard();settings(db,busy);const before=readState(db,scope,policyDigest);monotonic(before);
          const next=update(clone(before));if(types.isPromise(next)){Promise.prototype.then.call(next,undefined,()=>{});fail('JOURNAL_ASYNC_MUTATOR_REFUSED');}
          validateNext(before,next,scope,policyDigest);const row=rowFor(next,scope,policyDigest);
          const updated=db.prepare('UPDATE main.wallet_compute_journal SET revision=?,state_json=?,checksum=? WHERE singleton=1 AND revision=? AND checksum=?').run(row.revision,row.stateJSON,row.checksum,before.revision,rowFor(before,scope,policyDigest).checksum);check(updated.changes===1,'JOURNAL_UPDATE_CONFLICT');
          guard();settings(db,busy);check(canonical(readState(db,scope,policyDigest))===canonical(next),'JOURNAL_WRITE_MISMATCH');commitStarted=true;db.exec('COMMIT');begun=false;
          guard();settings(db,busy);lastSeen=clone(next);
          // Another serialized writer may commit after ours; the receipt is our committed state.
          return{committed:true,durable:true,state:clone(next)};
        }catch(e){if(begun)try{db.exec('ROLLBACK');}catch{faulted=true;}if(commitStarted){faulted=true;fail('JOURNAL_COMMIT_UNCERTAIN');}throw e;}finally{active=false;}
      },
      inspect(){ready();active=true;let begun=false;try{db.exec('BEGIN');begun=true;guard();settings(db,busy);const state=readState(db,scope,policyDigest);monotonic(state);db.exec('COMMIT');begun=false;guard();lastSeen=clone(state);return clone(state);}catch(e){if(begun)try{db.exec('ROLLBACK');}catch{faulted=true;}throw e;}finally{active=false;}},
      close(){if(closed)return;check(!active,'JOURNAL_REENTRANT');let error;try{db.close();}catch(e){error=e;}finally{try{fs.closeSync(fd);}finally{closed=true;}}if(error)throw error;},
      get closed(){return closed;},
    };
    return Object.freeze(adapter);
  }catch(e){try{db?.close();}catch{}if(fd!==undefined)try{fs.closeSync(fd);}catch{}throw e;}
}

export async function createWalletComputeJournal(input){return connect(input,true);}
export async function openWalletComputeJournal(input){return connect(input,false);}
