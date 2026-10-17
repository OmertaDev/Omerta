import crypto from 'node:crypto';
import * as Depot from './depot.js';
import { GameError, withCharacter } from './game.js';
import { DISTRICTS } from './rules.js';
import { assertItemTransaction, assertItemRead, withItemRead, poisonItemTransaction, registerItemTransactionUndo } from './items.js';
import { assertEstateResolutionScope } from './social/estate.js';
import { dbCaps } from './db.js';

export const BUSINESS_RELOCATION = Object.freeze({ kind:'canonical_depot_relocation_v1', minimumSeconds:60, maximumSeconds:600, plansPerOriginal:1, stockLimit:40, effect:'same_depot_settled_stock_paid_travel' });
const fail = reason => { throw new GameError(reason==='in_progress'?'business_relocation_in_progress':'business_relocation', reason); };
const identity = value => { if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value))fail('identity');return value; };
const exact = (value,keys) => value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const stable = value => JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const hash = value => crypto.createHash('sha256').update(stable(value)).digest('hex');
const fingerprint = value => {if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))fail('source_hash');return value;};
export function businessRelocationTerms(action,body){
 if(action==='create'){
  if(!exact(body,['businessId','destination','sourceHash','durationSeconds']))fail('terms');
  if(!DISTRICTS.some(d=>d.id===body.destination)||!Number.isSafeInteger(body.durationSeconds)||body.durationSeconds<60||body.durationSeconds>600)fail('terms');
  return {businessId:identity(body.businessId),destination:body.destination,sourceHash:fingerprint(body.sourceHash),durationSeconds:body.durationSeconds};
 }
 if(action==='execute'||action==='cancel'){
  if(!exact(body,['planId','sourceHash']))fail('terms');return {planId:identity(body.planId),sourceHash:fingerprint(body.sourceHash)};
 }
 fail('action');
}
function canonical(){
 // The implementation is a reviewed canonical module export, never caller data,
 // a supplied callback, a request key, or a configuration "verified" flag.
 const runtime=Depot.canonicalDepotRelocationRuntime;
 if(runtime?.kind!==BUSINESS_RELOCATION.kind||typeof runtime.inspect!=='function'||typeof runtime.execute!=='function'||typeof runtime.assertScope!=='function'||typeof runtime.withScope!=='function')fail('canonical_leaf_unavailable');
 if(!dbCaps.skipLocked)fail('transactional_backend_required');
 return runtime;
}
export function businessRelocationAvailability(){return {available:Depot.canonicalDepotRelocationRuntime?.kind===BUSINESS_RELOCATION.kind&&dbCaps.skipLocked&&Depot.depotPilotEnabled(),effect:BUSINESS_RELOCATION.effect};}
export async function replayBusinessRelocation(c,accountId,action,body,key){
 identity(accountId);if(typeof key!=='string'||!/^[!-~]{1,128}$/.test(key))fail('request_key');
 const terms=businessRelocationTerms(action,body),row=(await c.query('SELECT body_hash,receipt FROM business_relocation_requests WHERE account_id=$1 AND key_hash=$2',[accountId,hash([accountId,key])])).rows[0];
 if(!row)return null;if(row.body_hash!==hash({action,terms}))fail('request_conflict');if(!row.receipt)fail('in_progress');return row.receipt;
}
const view=row=>({planId:row.id,businessId:row.depot_id,originalCharacterId:row.original_character,destination:row.destination,sourceHash:row.source_hash,expiresAt:new Date(row.expires_at).toISOString(),state:row.state,revision:Number(row.revision)});
async function actionInCharacter(ch,action,body,key,c,h,{agent}={}){
 assertItemTransaction(c);
 try{
  const prior=await replayBusinessRelocation(c,ch.account_id,action,body,key);if(prior)return prior;
  const terms=businessRelocationTerms(action,body),runtime=canonical();
  if(typeof agent!=='boolean'||!ch.alive||ch.is_npc)fail('original_actor');
  // Mandatory canonical scope validates genuine G actor/h identity, actual current
  // actor/account locks, and existing delegated-control admission. No fake G frame.
  await runtime.assertScope(c,ch,h,{agent,action});
  const runId=crypto.randomUUID(),kh=hash([ch.account_id,key]),bh=hash({action,terms});
  await c.query('INSERT INTO business_relocation_requests(account_id,key_hash,body_hash,run_id) VALUES($1,$2,$3,$4) ON CONFLICT(account_id,key_hash) DO NOTHING',[ch.account_id,kh,bh,runId]);
  const request=(await c.query('SELECT body_hash,run_id,receipt FROM business_relocation_requests WHERE account_id=$1 AND key_hash=$2 FOR UPDATE',[ch.account_id,kh])).rows[0];
  if(request.body_hash!==bh)fail('request_conflict');if(request.receipt)return request.receipt;if(request.run_id!==runId)fail('in_progress');
  let receipt;
  if(action==='create'){
   const source=await runtime.inspect(c,ch,h,{businessId:terms.businessId,destination:terms.destination,agent});
   if(source.sourceHash!==terms.sourceHash)fail('source_changed');
   await c.query("UPDATE business_relocation_plans SET state='expired',revision=2 WHERE account_id=$1 AND state='ready' AND expires_at<=clock_timestamp()",[ch.account_id]);
   const old=(await c.query("SELECT id FROM business_relocation_plans WHERE account_id=$1 AND state='ready' FOR UPDATE",[ch.account_id])).rows;
   if(old.length)fail('pending_plan');
   const id=crypto.randomUUID(),now=new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed),end=new Date(+now+terms.durationSeconds*1000);
   await c.query("INSERT INTO business_relocation_plans(id,depot_id,account_id,original_character,destination,source_hash,source_snapshot,expires_at,revision,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,'ready')",[id,terms.businessId,ch.account_id,ch.id,terms.destination,terms.sourceHash,source.snapshot,end]);
   receipt={ok:true,...view({id,depot_id:terms.businessId,original_character:ch.id,destination:terms.destination,source_hash:terms.sourceHash,expires_at:end,revision:1,state:'ready'})};
  }else{
   // Source resolves the Depot lock before the plan lock; root runtime must keep
   // this order consistent with every canonical owner/estate operation.
   const hint=(await c.query('SELECT depot_id,destination FROM business_relocation_plans WHERE id=$1 AND account_id=$2',[terms.planId,ch.account_id])).rows[0];if(!hint)fail('plan');
   const source=await runtime.inspect(c,ch,h,{businessId:hint.depot_id,destination:hint.destination,agent,purpose:action});
   const row=(await c.query('SELECT * FROM business_relocation_plans WHERE id=$1 FOR UPDATE',[terms.planId])).rows[0];
   if(!row||row.account_id!==ch.account_id||row.original_character!==ch.id||row.state!=='ready'||row.revision!==1||row.source_hash!==terms.sourceHash)fail('plan');
   if(action==='cancel'){
    await c.query("UPDATE business_relocation_plans SET state='cancelled',revision=2 WHERE id=$1 AND state='ready' AND revision=1",[row.id]);receipt={ok:true,...view({...row,state:'cancelled',revision:2})};
   }else{
    const now=new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
    if(+now>=+new Date(row.expires_at)||source.sourceHash!==row.source_hash||stable(source.snapshot)!==stable(row.source_snapshot))fail('expired_or_source_changed');
    const outcome=await runtime.execute(c,ch,h,{plan:row,agent});
    // No response projection can substitute for exact canonical row/journal
    // verification. execute must final-validate before returning and scope exit.
    receipt={ok:true,...view({...row,state:'executed',revision:2}),outcome};
    const done=await c.query("UPDATE business_relocation_plans SET state='executed',revision=2,receipt=$2 WHERE id=$1 AND state='ready' AND revision=1",[row.id,receipt]);if(done.rowCount!==1)fail('revision');
   }
  }
  const saved=await c.query('UPDATE business_relocation_requests SET receipt=$4,account_ref=$1,actor_ref=$5 WHERE account_id=$1 AND key_hash=$2 AND run_id=$3 AND receipt IS NULL',[ch.account_id,kh,runId,receipt,ch.id]);if(saved.rowCount!==1)fail('receipt_changed');
  return receipt;
 }catch(error){poisonItemTransaction(c,error);throw error;}
}
export async function businessRelocationBoard(c,accountId){
 assertItemRead(c);
 const rows=(await c.query('SELECT id,depot_id,original_character,destination,source_hash,expires_at,state,revision FROM business_relocation_plans WHERE account_id=$1 ORDER BY id LIMIT 20',[identity(accountId)])).rows;
 return {...businessRelocationAvailability(),plans:rows.map(view),scope:'private_original_account_history'};
}


export async function runBusinessRelocation(pool,accountId,action,body,key,{agent}={}){
 identity(accountId);businessRelocationTerms(action,body);
 const prior=await withItemRead(pool,c=>replayBusinessRelocation(c,accountId,action,body,key));
 if(prior)return prior;
 const runtime=canonical();if(typeof agent!=='boolean')fail('internal_context');
 // Public typed action enters the real G leaf itself: no caller can provide ch,
 // h, ledger, owned cargo or an action callback. The reviewed root scope composes
 // existing family prelocks and final checks rather than fabricating a G frame.
 const result=await withCharacter(pool,accountId,(ch,c,h)=>actionInCharacter(ch,action,body,key,c,h,{agent}),{
  withActionScope:(c,a,execute)=>runtime.withScope(c,a,{action,terms:businessRelocationTerms(action,body)},execute)
 });
 const {character,...receipt}=result;return receipt;
}


export async function quoteBusinessRelocation(pool,accountId,body,{agent}={}){
 identity(accountId);if(!exact(body,['businessId','destination'])||!DISTRICTS.some(d=>d.id===body.destination))fail('terms');
 const terms={businessId:identity(body.businessId),destination:body.destination},runtime=canonical();if(typeof agent!=='boolean')fail('internal_context');
 const result=await withCharacter(pool,accountId,async(ch,c,h)=>{
  await runtime.assertScope(c,ch,h,{agent,action:'quote'});
  const source=await runtime.inspect(c,ch,h,{...terms,agent,purpose:'quote'});
  return {ok:true,businessId:terms.businessId,origin:source.snapshot.origin,destination:terms.destination,stock:Number(source.snapshot.depot.stock),stockCost:Number(source.snapshot.depot.stock_cost),travelCost:source.snapshot.travelCost,sourceHash:source.sourceHash,minimumSeconds:60,maximumSeconds:600,effect:BUSINESS_RELOCATION.effect};
 },{withActionScope:(c,a,execute)=>runtime.withScope(c,a,{action:'quote',terms},execute)});
 const {character,...quote}=result;return quote;
}

export async function voidBusinessRelocationsInEstate(c,characterId,estateScope){
 assertItemTransaction(c);
 try{
  await assertEstateResolutionScope(c,identity(characterId),estateScope);
  const rows=(await c.query("SELECT id,state,revision FROM business_relocation_plans WHERE original_character=$1 AND state='ready' ORDER BY id LIMIT 2 FOR UPDATE",[characterId])).rows;
  if(rows.length>1)fail('pending_plan_bound');
  for(const row of rows){
   registerItemTransactionUndo(c,()=>c.query("UPDATE business_relocation_plans SET state=$2,revision=$3 WHERE id=$1 AND state='owner_dead'",[row.id,row.state,row.revision]));
   await c.query("UPDATE business_relocation_plans SET state='owner_dead',revision=2 WHERE id=$1 AND state='ready'",[row.id]);
  }
  return {retiredPlans:rows.length,cashMoved:0,stockMoved:0};
 }catch(error){poisonItemTransaction(c,error);throw error;}
}


