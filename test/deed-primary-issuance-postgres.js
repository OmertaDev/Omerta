// Opt-in PostgreSQL conformance for the real deed modules. No server, chain or real credentials.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {phase2ErrorSummary} from './lib/phase2-error.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const tables = ['accounts','account_persistent','characters','vouchers','chain_reserve','street_deeds',
  'street_deed_paid_intents','street_deed_building_assignments','street_deed_supply','street_deed_history',
  'street_deed_primary_claims','deed_reimports','city_home_rooms','city_home_activities'];
function options(args) {
  assert(args.every(a => ['--preflight','--postgres'].includes(a) || a.startsWith('--output=')), 'Unknown option');
  assert.equal(args.filter(a => ['--preflight','--postgres'].includes(a)).length, 1, 'Choose one explicit mode');
  const outputs = args.filter(a => a.startsWith('--output='));
  if (args.includes('--preflight')) { assert.equal(outputs.length, 0); return {preflight:true}; }
  assert.equal(outputs.length, 1, 'Fresh explicit output directory required');
  assert(outputs[0].slice(9), 'Output path required');
  return {preflight:false, output:path.resolve(outputs[0].slice(9))};
}
function target(raw) {
  assert(typeof raw === 'string' && raw.length > 0, 'Explicit DEED_PRIMARY_TEST_ADMIN_URL required');
  const u = new URL(raw);
  assert(['postgres:','postgresql:'].includes(u.protocol), 'PostgreSQL protocol required');
  assert(['127.0.0.1','localhost','[::1]'].includes(u.hostname), 'Loopback server required');
  assert(u.port && u.port !== '5432', 'Explicit nondefault test port required');
  assert(u.pathname === '/postgres' && !u.search && !u.hash, 'Dedicated control database required');
  return u;
}
function selectedSchema(schema) {
  const statements = tables.map(name => {
    const sql = new RegExp(`^CREATE TABLE IF NOT EXISTS ${name}\\s*\\([\\s\\S]*?^\\);`, 'm').exec(schema)?.[0];
    assert(sql, 'Required production table missing'); return {table:name, sql};
  });
  for (const name of ['street_deeds','deed_reimports','city_home_rooms']) {
    for (const match of schema.matchAll(new RegExp(`^ALTER TABLE ${name} [\\s\\S]*?;`, 'gm')))
      statements.push({table:name, sql:match[0]});
  }
  for (const match of schema.matchAll(/^CREATE (?:UNIQUE )?INDEX IF NOT EXISTS [^\r\n]+ ON (street_deeds|city_home_activities)\s*[\s\S]*?;/gm))
    statements.push({table:match[1], sql:match[0]});
  assert(statements.some(s => s.sql.includes('primary_issuance_receipt')));
  assert(statements.some(s => s.sql.includes('last_extraction_receipt')));
  assert(statements.some(s => s.sql.includes('burn_receipt')));
  assert(statements.some(s => s.sql.includes('ix_street_deeds_name')));
  assert(statements.some(s => s.sql.includes('ix_street_deeds_building')));
  for (const statement of statements) for (const ref of statement.sql.matchAll(/REFERENCES\s+(\w+)/g))
    assert(tables.includes(ref[1]), 'Required production foreign-key closure must be selected');
  return statements;
}
async function preflight() {
  options(['--preflight']); options(['--postgres','--output=synthetic-output']);
  for (const args of [[],['--postgres'],['--preflight','--postgres'],['--preflight','--output=x'],['--unknown']])
    assert.throws(() => options(args));
  target('postgresql://synthetic@127.0.0.1:35461/postgres');
  for (const value of [undefined,'','https://localhost:35461/postgres','postgresql://remote.invalid:35461/postgres',
    'postgresql://localhost/postgres','postgresql://localhost:5432/postgres','postgresql://localhost:35461/omerta',
    'postgresql://localhost:35461/postgres?options=unsafe','postgresql://localhost:35461/postgres#fragment'])
    assert.throws(() => target(value));
  const ddl = selectedSchema(await fs.readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  console.log(JSON.stringify({complete:true,phase:'HOST_MODE_AND_SOURCE_DDL_SELECTION_ONLY',tables:tables.length,
    selectedStatements:ddl.length,pgImported:false,applicationImported:false,credentialEnvironmentRead:false,
    databaseConnections:0,nativeCasesExecuted:false}));
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function native({output}) {
  // Refuse inherited application/driver credentials without reading their values. A clean, owned
  // child must omit these names (including empty DATABASE_URL); only the dedicated test DSN is read.
  const inherited = Object.keys(process.env).map(k => k.toUpperCase());
  assert(!inherited.some(k => k.startsWith('PG') || k.startsWith('CHAIN_') || ['DATABASE_URL','VOUCHER_SIGNER_PK',
    'STREET_DEED_ADDRESS','STREET_DEED_RUNTIME_HASH','DEED_RECOVERY_ADDRESS','DEED_RECOVER_AFTER_MS',
    'VOUCHER_RECLAIM_GRACE_SEC','NODE_OPTIONS','NODE_PATH'].includes(k)),
  'Clean native test environment required');
  assert.equal(process.env.NODE_ENV, 'test', 'Explicit test environment required');
  const endpoint = target(process.env.DEED_PRIMARY_TEST_ADMIN_URL);
  await fs.mkdir(output, {recursive:false});
  const artifact = (name, value) => fs.writeFile(path.join(output,name), JSON.stringify(value,null,2)+'\n', {flag:'wx'});
  const schema = await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8');
  const ddl = selectedSchema(schema), cases=[], lockObservations=[], signatures=[], nativeReads=[];
  const sourcePaths = ['src/chain.js','src/deeds.js','src/deedbuildings.js','src/deedbenefits.js',
    'schema.sql','tools/rc1-native-database.js','test/deed-primary-issuance-postgres.js'];
  const pins = await Promise.all(sourcePaths.map(async file => {
    const bytes = await fs.readFile(path.join(root,file)); return {path:file,bytes:bytes.length,sha256:digest(bytes)};
  }));
  const revision = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
  let database, creationAttempted=false, created=false, closed=null, failure=null, snapshot;
  let stage='dependency_imports', activeCase=null;
  const pools=new Set(), activeTransactions=new Set();
  const safeFailure = error => {
    const summary=phase2ErrorSummary(error);
    const location=/^assertion at ([A-Za-z0-9][A-Za-z0-9_.-]*\.m?js:[1-9]\d{0,6}:[1-9]\d{0,6});/.exec(summary)?.[1];
    let code;try{code=error?.code;}catch{}
    return {category:summary.startsWith('assertion at ') ? 'assertion_failed' : 'native_case_failed',
      code:['ECONNREFUSED','ETIMEDOUT','28P01','55P03','57014'].includes(code) ? code : 'test_failed',
      ...(location ? {assertionLocation:location} : {})};
  };
  await artifact('source-before-import.json',{revision,pins,selectedStatements:ddl.length,
    pgAndApplicationImported:false,databaseCreationAttempted:false});
  try {
    const {default:pg} = await import('pg');
    const {planOwnedWorldDatabase} = await import('../tools/rc1-native-database.js');
    const viem = await import('viem');
    const {privateKeyToAccount} = await import('viem/accounts');
    // PUBLIC TEST FIXTURE ONLY. This known key signs local synthetic payloads; it is never funded,
    // connected to an RPC, selected from user configuration or used to send a transaction.
    const publicFixtureKey='0x'+'01'.repeat(32);
    const A=viem.getAddress('0x'+'12'.repeat(20)), B=viem.getAddress('0x'+'23'.repeat(20));
    const treasury=viem.getAddress('0x'+'56'.repeat(20)), contract=viem.getAddress('0x'+'34'.repeat(20));
    const runtimeHash=viem.keccak256('0x60016000');
    Object.assign(process.env,{CHAIN_ID:'31337',STREET_DEED_ADDRESS:contract,STREET_DEED_RUNTIME_HASH:runtimeHash,
      VOUCHER_SIGNER_PK:publicFixtureKey,DEED_RECOVERY_ADDRESS:treasury});
    const Chain=await import('../src/chain.js'), Deeds=await import('../src/deeds.js');
    const Benefits=await import('../src/deedbenefits.js');
    const signerAddress=privateKeyToAccount(publicFixtureKey).address;
    const lock=JSON.parse(await fs.readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
    database=planOwnedWorldDatabase({controlUrl:endpoint.href,runId:'deed-primary-'+crypto.randomBytes(8).toString('hex'),sourceRevision:revision});
    await artifact('source.json',{phase:'REAL_IMPORTED_MODULES_AND_REQUIRED_PRODUCTION_DDL',revision,pins,
      imports:['src/chain.js','src/deeds.js','src/deedbenefits.js'],copiedFunctionBodies:false,VM:false,
      pgLockVersion:lock.packages['node_modules/pg'].version,pgLockIntegrity:lock.packages['node_modules/pg'].integrity,
      database:database.descriptor,syntheticPublicFixtureSigner:true,actualRPC:false,serverStarted:false,
      schemaScope:'Required exact production CREATE/ALTER/index statements plus actual migrateDeedBenefitStorage; not full application boot/RLS/other migrations',
      selectedDDL:ddl.map(s=>({table:s.table,bytes:Buffer.byteLength(s.sql),sha256:digest(s.sql)}))});
    await fs.writeFile(path.join(output,'schema-used.sql'),ddl.map(s=>s.sql).join('\n')+'\n',{flag:'wx'});
    stage='owned_database_creation';creationAttempted=true;const lease=await database.create();created=true;await artifact('lease-created.json',lease);
    const poolConfig={connectionString:database.url,max:8,application_name:'omerta-deed-native',
      options:'-c statement_timeout=12000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=15000'};
    const open=extra=>{const p=new pg.Pool({...poolConfig,...extra});pools.add(p);return p;};
    let raw=open();const observer=open({max:1});
    const appPool={query:(...args)=>raw.query(...args),async connect(){
      const c=await raw.connect();return {processID:c.processID,release:(destroy=false)=>{if(destroy)activeTransactions.delete(c.processID);c.release(destroy);},async query(sql,params){
        const result=await c.query(sql,params);
        if(sql==='BEGIN')activeTransactions.add(c.processID);
        if(sql==='COMMIT'||sql==='ROLLBACK')activeTransactions.delete(c.processID);
        return result;
      }};
    }};
    stage='required_schema';for(const s of ddl)await raw.query(s.sql);
    await Benefits.migrateDeedBenefitStorage(raw);
    const profile=(await raw.query('SELECT version() AS version,current_database() AS database')).rows[0];
    assert.equal(profile.database,database.descriptor.name);await artifact('postgres.json',profile);
    async function transaction(work){const c=await appPool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}
      catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}
    const street='Native Test Avenue', lot='docks-0168', hash=c=>'0x'+c.repeat(64), token=Chain.deedTokenId(street);
    let quote;
    const ready=()=>Object.assign(quote,{identityIssued:true,nativeName:street,nativeDistrict:'The Docks',valueWei:'0',liveOwner:null,blockNumber:'110'});
    const reader=async(name,district)=>{
      assert.equal(activeTransactions.size,0,'Native reads must occur outside held SQL transactions');
      assert.equal(name,street);assert.equal(district,'The Docks');nativeReads.push({name,blockNumber:quote.blockNumber,outsideTransaction:true});
      return {...quote};
    };
    const meta=(extra={})=>({confirmed:true,chainId:31337,contract,runtimeHash,transactionHash:hash('b'),
      blockHash:hash('a'),blockNumber:'100',logIndex:2,tokenId:token,...extra});
    const extracted=v=>({...meta(),nonce:Number(v.nonce),to:A,name:street,district:'The Docks',
      issue:{...meta({logIndex:3}),kind:'paid',to:A,count:'1',payer:A,amount:'10000000000000000'}});
    const earlyBurn=()=>({...meta({logIndex:1}),from:A,ref:hash('b')+':1'});
    async function seed(){
      assert.equal(activeTransactions.size,0);
      await raw.query(`TRUNCATE ${[...tables,'street_deed_benefit_eligibility'].join(',')} RESTART IDENTITY CASCADE`);
      for(const [id,wallet]of [['a',A],['b',B]]){
        await raw.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)',[id,'synthetic-native']);
        await raw.query('INSERT INTO account_persistent(account_id,minted,wallet_address) VALUES($1,true,$2)',[id,wallet]);
        await raw.query('INSERT INTO characters(id,account_id,name,season,respect,minted) VALUES($1,$2,$3,1,100000,true)',['char-'+id,id,'Synthetic '+id]);
      }
      await raw.query('INSERT INTO chain_reserve(id,funded_omr,next_nonce) VALUES(1,0,1)');
      await raw.query('INSERT INTO street_deed_supply(id,issued) VALUES(1,0)');
      quote={name:street,district:'The Docks',tokenId:token,chainId:31337,contract,runtimeHash,blockNumber:'100',blockHash:hash('a'),
        timestamp:String(Math.floor(Date.now()/1000)),identityIssued:false,nativeName:'',nativeDistrict:'',gameplayIdentity:false,
        liveOwner:null,valueWei:'10000000000000000',usedNonce:false};
    }
    const character=async id=>(await raw.query('SELECT * FROM characters WHERE account_id=$1',[id])).rows[0];
    const reserve=(id='a',name=street,buildingId=lot)=>transaction(async c=>Deeds.reservePaidDeed(await character(id),{name,buildingId,district:'docks'},c));
    const request=()=>Chain.requestDeedWithdraw(appPool,'a',A,{attest:true,reader});
    async function start(){await seed();await reserve();return request();}
    async function reopen(){assert.equal(activeTransactions.size,0);await raw.end();pools.delete(raw);raw=open();}
    snapshot=async()=>({
      intents:(await raw.query('SELECT * FROM street_deed_paid_intents ORDER BY account_id')).rows,
      streets:(await raw.query('SELECT * FROM street_deeds ORDER BY name')).rows,
      assignments:(await raw.query('SELECT * FROM street_deed_building_assignments ORDER BY building_id')).rows,
      supply:(await raw.query('SELECT * FROM street_deed_supply')).rows,
      reserve:(await raw.query('SELECT id,funded_omr::text,next_nonce::text FROM chain_reserve')).rows,
      vouchers:(await raw.query('SELECT * FROM vouchers ORDER BY nonce')).rows,
      burns:(await raw.query('SELECT * FROM deed_reimports ORDER BY ref')).rows,
      activities:(await raw.query('SELECT * FROM city_home_activities ORDER BY id')).rows,
      balances:(await raw.query('SELECT account_id,omr::text FROM account_persistent ORDER BY account_id')).rows,
    });
    async function record(name,work){stage='native_cases';activeCase=name;await work();cases.push({name,outcome:'PASS',state:await snapshot()});activeCase=null;console.log('PASS '+name);}
    async function homeActivity(){const d=(await raw.query('SELECT * FROM street_deeds WHERE name=$1',[street])).rows[0];
      await raw.query('INSERT INTO city_home_rooms(home_key,authority_token,owner_account_id) VALUES($1,$2,$3)',[d.name_lc,d.home_authority_token,'a']);
      await raw.query(`INSERT INTO city_home_activities(id,home_key,authority_token,host_account_id,host_character_id,host_generation,puzzle_id,layout_revision,layout_json,status)
        VALUES('synthetic-open',$1,$2,'a','char-a',1,'evening-notebook',1,'[]','open')`,[d.name_lc,d.home_authority_token]);return d.home_authority_token;
    }
    await record('inert paid intent persists without corner benefits or permanent supply/nonce effects',async()=>{
      await seed();await reserve();const ch=await character('a');let ledgerCalls=0;
      await assert.rejects(()=>transaction(c=>Deeds.collectCorner(ch,c,{ledger:async()=>{ledgerCalls++;throw Error('unexpected benefit');}})),e=>e.code==='no_corner');
      assert.equal(ledgerCalls,0);const s=await snapshot();assert.equal(s.streets.length,0);assert.equal(s.assignments.length,0);
      assert.equal(s.supply[0].issued,0);assert.equal(s.reserve[0].next_nonce,'1');assert.equal(s.vouchers.length,0);
      await reopen();assert.deepEqual(await snapshot(),s);
    });
    await record('real name and lot reservation races wait on the lifetime row and admit exactly one intent',async()=>{
      for(const [otherName,otherLot]of [[street,'docks-0169'],['Other Test Avenue',lot],[street.toLowerCase(),'docks-0169']]){
        await seed();let holder,waiter,pending,operationError;
        try{holder=await appPool.connect();waiter=await appPool.connect();await holder.query('BEGIN');await waiter.query('BEGIN');
          await Deeds.reservePaidDeed(await character('a'),{name:street,buildingId:lot},holder);
          pending=Deeds.reservePaidDeed(await character('b'),{name:otherName,buildingId:otherLot},waiter).then(value=>({value}),error=>({error}));
          const until=Date.now()+5000;let observed=false;
          while(Date.now()<until){const row=(await observer.query('SELECT wait_event_type,wait_event FROM pg_stat_activity WHERE pid=$1 AND datname=$2',[waiter.processID,database.descriptor.name])).rows[0];
            if(row?.wait_event_type==='Lock'){lockObservations.push({pid:waiter.processID,...row});observed=true;break;}await pause(20);}
          assert(observed,'Owned competing reservation must have an observed PostgreSQL lock wait');await holder.query('COMMIT');
          const result=await pending;assert.equal(result.error?.code,'taken');await waiter.query('ROLLBACK');
          const s=await snapshot();assert.equal(s.intents.length,1);assert.equal(s.intents[0].account_id,'a');assert.equal(s.supply[0].issued,0);assert.equal(s.reserve[0].next_nonce,'1');
        }catch(error){operationError=error;throw error;}finally{
          let cleanupFailed=false;
          if(holder){let destroy=false;try{await holder.query('ROLLBACK');}catch{destroy=true;cleanupFailed=true;}
            finally{try{holder.release(destroy);}catch{cleanupFailed=true;}}}
          try{if(pending)await pending;}catch{cleanupFailed=true;}
          if(waiter){let destroy=false;try{await waiter.query('ROLLBACK');}catch{destroy=true;cleanupFailed=true;}
            finally{try{waiter.release(destroy);}catch{cleanupFailed=true;}}}
          if(cleanupFailed&&!operationError)throw Error('owned_reservation_cleanup_failed');
        }
      }
    });
    await record('real synthetic signing, calldata and pending retry preserve one nonce and an inert intent',async()=>{
      const v=await start();assert.equal(v.transaction.value,'10000000000000000');assert.equal(v.claimMethod,'claim');
      assert.equal(viem.decodeFunctionData({abi:Chain.DEED_CLAIM_ABI,data:v.transaction.data}).functionName,'claim');
      const recovered=await viem.recoverTypedDataAddress({domain:Chain.deedChainConfig(),types:Chain.DEED_VOUCHER_TYPES,primaryType:'DeedVoucher',
        message:{...v.voucher,nonce:BigInt(v.voucher.nonce),deadline:BigInt(v.voucher.deadline)},signature:v.signature});
      assert.equal(recovered.toLowerCase(),signerAddress.toLowerCase());signatures.push({voucherId:v.id,syntheticSigner:recovered});
      quote.valueWei='20000000000000000';const retry=await request();assert.equal(retry.signature,v.signature);assert.equal(retry.transaction.data,v.transaction.data);
      // PostgreSQL BIGINT is exact decimal text; the first-sign response uses a guarded safe Number.
      // Bind both API representations to the real stored nonce instead of requiring JS type identity.
      const nonceColumn=await raw.query('SELECT nonce FROM vouchers WHERE id=$1',[v.id]);
      assert.equal(nonceColumn.fields[0].dataTypeID,20);const persistedNonce=nonceColumn.rows[0].nonce;
      assert.equal(typeof persistedNonce,'string');assert.match(persistedNonce,/^(0|[1-9]\d*)$/);
      assert.equal(String(v.nonce),persistedNonce);assert.equal(String(retry.nonce),persistedNonce);
      assert.equal(retry.transaction.value,'20000000000000000');const s=await snapshot();assert.equal(s.vouchers.length,1);assert.equal(s.reserve[0].next_nonce,'2');assert.equal(s.streets.length,0);
      await assert.rejects(()=>Chain.requestDeedWithdraw(appPool,'a',A,{attest:false,reader}),e=>e.code==='attestation');assert.deepEqual(await snapshot(),s);
    });
    await record('confirmed first paid receipt and JSONB survive reopen and exactly-once replay',async()=>{
      const v=await start();await Chain.markDeedExtracted(appPool,extracted(v));const s=await snapshot();
      assert.equal(s.streets[0].account_id,'onchain:'+token);assert.equal(s.streets[0].primary_issuance_receipt.kind,'paid');
      assert.equal(s.supply[0].issued,1);assert.equal(s.assignments.length,1);assert.equal(s.intents.length,0);
      const json=(await raw.query('SELECT primary_issuance_receipt FROM street_deeds')).fields[0];assert.equal(json.dataTypeID,3802);
      await reopen();assert.equal((await Chain.markDeedExtracted(appPool,extracted(v))).duplicate,true);assert.deepEqual(await snapshot(),s);
    });
    await record('early same-transaction paid burn persists pending then exact replay applies after materialization',async()=>{
      const v=await start();ready();assert.equal((await Chain.reimportDeed(appPool,earlyBurn(),{reader})).pending,true);
      const early=await snapshot();assert.equal(early.burns[0].status,'pending');assert.equal(early.burns[0].burn_receipt.name,undefined);assert.equal(early.streets.length,0);
      await reopen();assert.deepEqual(await snapshot(),early);await Chain.markDeedExtracted(appPool,extracted(v));const authority=await homeActivity();
      assert.equal((await Chain.reimportDeed(appPool,earlyBurn(),{reader})).applied,true);const s=await snapshot();
      assert.equal(s.streets[0].account_id,'a');assert.equal(s.streets[0].onchain_token_id,null);assert.notEqual(s.streets[0].home_authority_token,authority);
      assert.equal(s.activities[0].status,'closed');assert.equal(s.activities[0].close_reason,'ownership_changed');assert.equal(s.burns[0].status,'applied');
      assert.equal(s.supply[0].issued,1);assert.equal(s.reserve[0].next_nonce,'2');assert.equal((await Chain.reimportDeed(appPool,earlyBurn(),{reader})).duplicate,true);
    });
    await record('actual sweep retains pending on native read and SQL failure then retries atomically',async()=>{
      const v=await start();ready();await Chain.reimportDeed(appPool,earlyBurn(),{reader});await Chain.markDeedExtracted(appPool,extracted(v));await homeActivity();
      const before=await snapshot();assert.equal((await Chain.sweepDeedReimports(appPool,{reader:async()=>{throw Error('synthetic read refusal');}})).applied,0);assert.deepEqual(await snapshot(),before);
      await raw.query(`CREATE FUNCTION synthetic_reimport_refusal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic SQL refusal' USING ERRCODE='P0001'; END; $$`);
      await raw.query('CREATE TRIGGER synthetic_reimport_refusal BEFORE INSERT ON street_deed_history FOR EACH ROW EXECUTE FUNCTION synthetic_reimport_refusal()');
      try{assert.equal((await Chain.sweepDeedReimports(appPool,{reader})).applied,0);assert.deepEqual(await snapshot(),before);}
      finally{await raw.query('DROP TRIGGER synthetic_reimport_refusal ON street_deed_history');await raw.query('DROP FUNCTION synthetic_reimport_refusal()');}
      assert.equal((await Chain.sweepDeedReimports(appPool,{reader})).applied,1);assert.equal((await snapshot()).streets[0].account_id,'a');
    });
    await record('invalid first payment and pending native identity refuse without nonce or benefit changes',async()=>{
      const v=await start(),bad=extracted(v);bad.issue.amount='1';const s=await snapshot();
      await assert.rejects(()=>Chain.markDeedExtracted(appPool,bad),e=>e.code==='migration_required');assert.deepEqual(await snapshot(),s);
      ready();await Chain.reimportDeed(appPool,earlyBurn(),{reader});await Chain.markDeedExtracted(appPool,extracted(v));const pending=await snapshot();
      for(const change of [{liveOwner:A},{runtimeHash:hash('f')},{blockNumber:'99'},{nativeDistrict:'Wrong District'}]){
        const saved={...quote};Object.assign(quote,change);await assert.rejects(()=>Chain.reimportDeed(appPool,earlyBurn(),{reader}),e=>e.code==='migration_required');
        assert.deepEqual(await snapshot(),pending);quote=saved;
      }
      assert.equal((await Chain.sweepDeedReimports(appPool,{reader})).applied,1);
    });
    await record('unlinked burn waits and only existing delayed fixed-recipient recovery retires pending refs',async()=>{
      const v=await start();ready();await Chain.reimportDeed(appPool,earlyBurn(),{reader});await Chain.markDeedExtracted(appPool,extracted(v));
      await raw.query('UPDATE account_persistent SET wallet_address=NULL WHERE account_id=$1',['a']);
      assert.equal((await Chain.sweepDeedReimports(appPool,{reader})).applied,0);const pending=await snapshot();
      assert.equal(pending.burns[0].burn_receipt.name,street);assert.equal(pending.streets[0].account_id,'onchain:'+token);
      await assert.rejects(()=>Chain.recoverStrandedDeed(appPool,{street,reader}),e=>e.code==='too_soon');assert.deepEqual(await snapshot(),pending);
      await raw.query("UPDATE deed_reimports SET created_at=now()-interval '31 days' WHERE ref=$1",[earlyBurn().ref]);
      // An additional inert pending-store ref must also be retired; it grants no ownership proof.
      await raw.query(`INSERT INTO deed_reimports(ref,wallet_address,token_id,burn_receipt) SELECT $1,wallet_address,token_id,burn_receipt FROM deed_reimports WHERE ref=$2`,[hash('c')+':77',earlyBurn().ref]);
      const recovery=await Chain.recoverStrandedDeed(appPool,{street,reader});assert.equal(recovery.to,treasury);
      const after=await snapshot();assert(after.burns.every(r=>r.status==='superseded'));assert.equal(after.streets[0].account_id,'onchain:'+token);
      assert.equal(after.reserve[0].next_nonce,'3');assert.equal(after.supply[0].issued,1);
      assert.equal((await Chain.reimportDeed(appPool,earlyBurn(),{reader})).duplicate,true);
    });
    assert.equal(activeTransactions.size,0);
    for(const pin of pins)assert.equal(digest(await fs.readFile(path.join(root,pin.path))),pin.sha256,'Source remains frozen throughout native run');
    await artifact('cases.json',{complete:true,cases,lockObservations,nativeReads,syntheticSignaturesValidated:signatures,
      realCredentialOrRPCUse:false,serverStarted:false,fullApplicationBoot:false});
  }catch(error){failure={...safeFailure(error),stage,activeCase};let state=null;if(snapshot){try{state=await snapshot();}catch{}}
    await artifact('failure.json',{complete:false,...failure,cases,state,lockObservations});
  }finally{
    const ended=await Promise.allSettled([...pools].map(p=>p.end()));
    const allOwnPoolsEnded=ended.every(r=>r.status==='fulfilled');if(!allOwnPoolsEnded)failure||={category:'owned_pool_cleanup_failed',code:'test_failed'};
    if(creationAttempted){try{closed=await database.close();}catch{failure||={category:'owned_database_cleanup_failed',code:'test_failed'};}}
    await artifact('terminal.json',{complete:!failure,databaseCreationAttempted:creationAttempted,databaseCreationCompleted:created,
      databaseClosed:closed,allOwnPoolsEnded,activeTransactions:activeTransactions.size,casesPassed:cases.length,failure,
      noForeignBackendTermination:true,realRPC:false,realCredentials:false,production:false});
  }
  if(failure)throw Error('Native deed conformance or owned cleanup failed');
  console.log(JSON.stringify({complete:true,cases:cases.length,databaseClosed:closed?.closed===true,
    syntheticLocalSigning:true,realRPC:false,serverStarted:false,production:false}));
}
try{const mode=options(process.argv.slice(2));if(mode.preflight)await preflight();else await native(mode);}
catch{console.error('deed-primary-issuance-postgres: FAIL; inspect retained sanitized metadata if created');process.exitCode=1;}
