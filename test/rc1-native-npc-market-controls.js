import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker } from '../tools/rc1-native-worker.js';
import { createNpcFamilyCommitObserver } from '../tools/rc1-npc-family-provenance.js';
import { createNpcBoatAcquisitionCommitObserver } from '../tools/rc1-npc-boat-journal.js';
import { createNpcMarketOrderCommitObserver, NPC_MARKET_SOURCE_PINS, NPC_MARKET_SQL, reconcileNpcMarketOrder } from '../tools/rc1-npc-market-order-journal.js';
assert(process.argv.includes('--postgres'));assert(process.env.RC1_NPC_MARKET_OUTPUT);
const source=await sourceIdentity(),seed='rc1-alpha',epoch=Date.parse('2026-09-23T23:00:00Z'),output=process.env.RC1_NPC_MARKET_OUTPUT;
const database=planOwnedWorldDatabase({controlUrl:process.env.COORDINATION_TEST_DATABASE_URL,runId:'npc-market-controls',sourceRevision:source.revision});
const historyStorage={encoding:'gzip',framing:'event-members-v1',maximumDecodedBytes:536870912,maximumStoredBytes:134217728,maximumLineBytes:8388608,maximumOutstandingInvocations:64,maximumPendingRecords:64};
const configuration={seed,epoch:new Date(epoch).toISOString(),maximumHours:8,historyStorage,sourcePins:NPC_MARKET_SOURCE_PINS,
 scope:'Original worker NPC order fee sink and owned escrow; actual original callbacks and one composed returned-query collector',
 initialization:'25 initial schema-default human accounts/characters; original worker creates all NPC resources and eligibility. No postbaseline gameplay fixtures.',
 fault:'Prebaseline AFTER INSERT trigger verifies original fee/escrow receipts and pocket parity, then aborts all initial eligible order attempts until callback completion. Remove only diagnostic trigger; original later worker callback retries.',
 exclusions:['Player postOrder skill/mastery fee branches','Fills/refunds/cancels/death/terminal disposition','Full-season/matrix qualification','Same-request idempotency: worker turns have no request key']};
for(const key of ['POPULATION_OFF','SEASON_MOD','SEASON_PHASE','LAW_BUST_P','CHAIN_RPC_URL','CHAIN_SIGNER_PK','LIQUIDITY_RPC_URL','LIQUIDITY_RPC_FALLBACK_URL','INVARIANT_WEBHOOK_URL','REDIS_URL'])assert(!process.env[key],`Undeclared override ${key}`);
Object.assign(process.env,{DATABASE_URL:database.url,CORE_PROGRESSION:'on',WORLD_GRAPH_KERNEL:'on',COORDINATION_ENGINE:'on',COORDINATION_KNOWLEDGE:'on',COORDINATION_KNOWLEDGE_SHARING:'on',COORDINATION_OPERATIONS:'on',
 LIVING_WORLD_DIRECTOR:'LIVE',LIQUIDITY_AUTOMATION_ENABLED:'off',SOCIAL_VERIFY_MODE:'off',RATE_LIMIT:'off',INVITE_MODE:'off',JWT_SECRET:crypto.randomBytes(32).toString('hex'),MOD_KEY:crypto.randomBytes(32).toString('hex'),MARKET_SEED:crypto.randomBytes(32).toString('hex')});
const proof=await createProofRecorder({directory:output,source,configuration,runId:'npc-market-controls',seed,scenarioId:'npc-market-native-controls',population:25,historyStorage});
const runtime=installSerialRuntime(seed,configuration.epoch);let at=epoch;runtime.bindClock(()=>at);
const controller=createWorkerSchedule({start:epoch,setClock:value=>{at=value;},expectedDormant:[{label:'RWA health',code:'health_registry_unavailable'}]});
const namespace=`rc1_npc_market_${process.pid}`,base=new pg.Pool({connectionString:database.url}),readPool=new pg.Pool({connectionString:database.url,options:`-c search_path=${namespace},pg_catalog -c default_transaction_read_only=on`,max:1});
let snapshotWorldResources,reconcileWorldResources,worldResourceHash,previous,pool,result,firstError,faultInstalled=true,boundaries=0,rollbacks=0;
const attempts=[],logs=[],candidates=[],controls=[],unknown={},nativeConsole={log:console.log,warn:console.warn,error:console.error};
const observer=createNpcFamilyCommitObserver({innerObserverFactory:options=>createNpcMarketOrderCommitObserver({...options,
 innerObserverFactory:extra=>createNpcBoatAcquisitionCommitObserver({...extra,seed,readRandomTape:()=>runtime.tape})}),
 context:()=>({authority:'original-worker',logicalAt:at}),onAttempt:async event=>{if(event.outcome==='THREW'&&event.code==='RNM01'){attempts.push(event);await proof.record({kind:'expected-market-fault',event});}},
 onBoundary:async(event,transaction,npcFamilyProvenance)=>{
  if(firstError)throw firstError;const before=previous,after=await snapshotWorldResources(readPool);
  try{
   if(['ROLLED_BACK','STATEMENT_ABORTED'].includes(event.outcome))assert.equal(worldResourceHash(before),worldResourceHash(after),'Aborted SQL changed resources');
   if(event.outcome==='ROLLED_BACK'&&attempts.some(row=>row.transactionId===event.transactionId)){
    rollbacks++;await proof.artifact(`market-fault-rollback-${rollbacks}.json`,{before,after,event,attempt:attempts.find(row=>row.transactionId===event.transactionId)});
   }
   const witness=transaction?.queries.some(row=>row.sql===NPC_MARKET_SQL.listing)?transaction:null;
   const journal=reconcileWorldResources(before,after,{identity:event,carMeltProvenance:transaction,carAcquisitionProvenance:transaction,npcBoatProvenance:transaction,npcFamilyProvenance,npcMarketOrderProvenance:witness,includeRestrictedChanges:true});
   if(witness){assert.equal(journal.npcMarketOrder.movements.length,1);const input={before,after,event,provenance:witness,receipts:journal.receipts};
    candidates.push(input);await proof.artifact(`market-candidate-${String(candidates.length).padStart(3,'0')}.json`,input);}
   for(const item of journal.unsupported)unknown[item.kind]=(unknown[item.kind]||0)+1;
   await proof.record({kind:'resource-commit-boundary',event,journal});boundaries++;previous=after;
  }catch(error){firstError=error;await proof.artifact('first-resource-failure.json',{before,after,event,transaction,error:{message:error.message,stack:error.stack}});throw error;}
 }});
const seam=installWorkerInstrumentation(controller,{namespace,commitObserver:observer});
try{
 for(const key of ['log','warn','error'])console[key]=(...args)=>{
  if(faultInstalled&&key==='error'&&args[0]==='[population] resident action failed'&&String(args[2]).includes('RC1_NPC_MARKET_ABORT')){logs.push({owner:args[1],message:args[2],logicalAt:at});return;}
  controller.log(key,args);
 };
 await proof.record({kind:'database-created',...await database.create()});await base.query('CREATE SCHEMA '+namespace);
 const bootstrap=new controller.Pool({connectionString:database.url,max:20});await seam.clock.initialize(bootstrap);pool=await makeWorkerDatabase(controller);
 ({snapshotWorldResources,reconcileWorldResources,worldResourceHash}=await import('../tools/rc1-world-resource-observer.js'));
 const {runLedgerInvariants}=await import('../src/invariants.js');
 for(let i=0;i<25;i++){const id=`quiet-player-${i}`;await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)",[id]);
  await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)',[id]);await pool.query('INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$3,$4,$5)',[`${id}-character`,id,id,Math.floor(epoch/(86400000*28)),'docks']);}
 const trigger=`CREATE FUNCTION rc1_market_abort() RETURNS trigger LANGUAGE plpgsql AS $fault$ BEGIN
   IF NEW.kind='order' AND EXISTS(SELECT 1 FROM characters WHERE id=NEW.seller_character AND is_npc) THEN
    IF NEW.status<>'live' OR NEW.filled_qty<>0 OR NOT EXISTS(SELECT 1 FROM transactions WHERE character_id=NEW.seller_character AND reason='market:order' AND amount=-(NEW.qty*NEW.price) AND at=now())
     OR NOT EXISTS(SELECT 1 FROM transactions WHERE character_id=NEW.seller_character AND reason='market:list' AND amount=-GREATEST(10,FLOOR(NEW.qty*NEW.price/100)) AND at=now())
     OR NOT EXISTS(SELECT 1 FROM characters c WHERE c.id=NEW.seller_character AND c.cash+c.bank=500+COALESCE((SELECT SUM(amount) FROM transactions WHERE character_id=c.id AND currency='cash'),0))
    THEN RAISE EXCEPTION 'Market fault predecessors missing' USING ERRCODE='RNM02'; END IF;
    RAISE EXCEPTION 'RC1_NPC_MARKET_ABORT owner=%',NEW.seller_character USING ERRCODE='RNM01';
   END IF;RETURN NEW;END $fault$`;
 await pool.query(trigger);await pool.query('CREATE TRIGGER rc1_market_abort AFTER INSERT ON market_listings FOR EACH ROW EXECUTE FUNCTION rc1_market_abort()');
 await proof.artifact('initialization.json',{configuration,trigger,postbaselineGameplayFixtures:false});assert((await runLedgerInvariants(pool,{alert:false})).ok);await proof.snapshot(pool,'initial');
 const resourceBeforeBoot=await snapshotWorldResources(readPool);
 await bootOriginalWorker(controller,{beforeCallbacks:async()=>{previous=await snapshotWorldResources(readPool);assert.equal(worldResourceHash(previous),worldResourceHash(resourceBeforeBoot));observer.arm();}});
 let invariantBoundaries=0;
 const afterCallback=async()=>{
  if(faultInstalled&&logs.length){assert.equal(rollbacks,logs.length);assert.equal(attempts.length,logs.length);
   await base.query(`SET search_path=${namespace},pg_catalog`);await base.query('DROP TRIGGER rc1_market_abort ON market_listings');await base.query('DROP FUNCTION rc1_market_abort()');faultInstalled=false;
   await proof.record({kind:'diagnostic-trigger-removed',logicalAt:at,gameplayMutation:false,attempts:attempts.length});}
  const inv=await runLedgerInvariants(pool,{alert:false});assert(inv.ok);invariantBoundaries++;await proof.record({kind:'canonical-invariants',logicalAt:at,checks:inv.checks});
 };
 await afterCallback();for(let hour=1;hour<=configuration.maximumHours;hour++)await controller.advanceTo(epoch+hour*3600000,afterCallback);
 assert(logs.length>0);assert.equal(logs.length,rollbacks);assert.equal(logs.length,attempts.length);assert(candidates.length>0);
 const retries=candidates.filter(input=>logs.some(log=>log.owner===input.after.tables.market_listings.find(row=>!input.before.tables.market_listings.some(old=>old.id===row.id))?.seller_character));
 assert(retries.length>0,'No failed owner retried through original worker within declared hours');
 for(const input of candidates)for(const [name,mutate]of[
  ['foreign listing owner',p=>{p.after.tables.market_listings.find(r=>!p.before.tables.market_listings.some(old=>old.id===r.id)).seller_character='foreign';}],
  ['duplicate receipt',p=>{p.receipts.push(structuredClone(p.receipts[0]));}],
  ['wrong receipt owner',p=>{p.receipts[0].character_id='foreign';}],
  ['changed deadline',p=>{p.after.tables.market_listings.find(r=>!p.before.tables.market_listings.some(old=>old.id===r.id)).expires_at=new Date(at).toISOString();}],
  ['foreign native boundary',p=>{p.event={...p.event,transactionId:p.event.transactionId+1};}],
 ]){const corrupt=structuredClone(input);mutate(corrupt);assert.throws(()=>reconcileNpcMarketOrder(corrupt.before,corrupt.after,corrupt.receipts,corrupt.provenance,corrupt.event));controls.push({name,candidate:candidates.indexOf(input)+1});}
 observer.assertComplete();assert.equal(firstError,undefined);observer.disarm();await proof.snapshot(pool,'final');
 await proof.artifact('worker-schedule.json',controller.diagnostic());await proof.artifact('observer-final.json',observer.diagnostic());await proof.artifact('random-tape.json',{draws:runtime.tape});await proof.artifact('faults-controls.json',{attempts,logs,controls});
 result={status:'PASS_SCOPED',boundaries,positivePlacements:candidates.length,rollbackCount:rollbacks,sameOwnerLaterWorkerRetries:retries.length,nativeEvidenceCorruptions:controls.length,
  invariantBoundaries,checksPerInvariantBoundary:55,logicalHours:8,unknown,fullResourceQualification:false,matrixQualifying:false};
}catch(error){result={status:'FAIL',message:error.message,stack:error.stack,boundaries,positivePlacements:candidates.length,rollbackCount:rollbacks};process.exitCode=1;
 await proof.record({kind:'failure',...result});await proof.artifact('failure-schedule.json',controller.diagnostic());await proof.artifact('failure-observer.json',observer.diagnostic());await proof.artifact('failure-rng.json',{draws:runtime.tape});await proof.artifact('failure-faults.json',{attempts,logs});
}finally{
 for(const key of ['log','warn','error'])console[key]=nativeConsole[key];
 for(const close of [async()=>{try{observer.disarm();}catch{}},()=>controller.close(),()=>readPool.end(),()=>base.end(),async()=>proof.record({kind:'database-cleanup',...await database.close()})])
  try{await close();}catch(error){result.status='FAIL';result.cleanupFailure=error.message;process.exitCode=1;}
 seam.restore();runtime.restore();const run=await proof.finish(result);await verifyArtifactIndex(output,run);
}
console.log(JSON.stringify(result));
