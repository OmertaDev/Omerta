import crypto from 'node:crypto';
import { GameError } from './game.js';
import * as I from './items.js';
import * as P from './companyproduction.js';
import * as D from './depot.js';
import * as H from './warehouseleases.js';
import * as Premises from './commercialpremises.js';
import * as C from './commissionedcrafting.js';
import { assertEquipmentUsable } from './itemdurability.js';

export const WORKSHOP_FLOOR=Object.freeze({slots:2,uses:Object.freeze(['tool_bench','storage','service']),toolTemplate:'item:precision_lock_tool',recipes:Object.freeze(['recipe:hardened_steel','recipe:precision_lock_tool','recipe:tempered_precision_lock_tool'])});
const fail=r=>{throw new GameError('workshop_floor',r);},id=v=>{if(typeof v!=='string'||!/^[!-~]{1,128}$/.test(v))fail('identity');return v;};
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...k].sort().join(',');
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a<b?-1:a>b?1:0)):x),hash=v=>crypto.createHash('sha256').update(stable(v)).digest('hex');
const clock=async c=>new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
function allocations(value){
  if(!Array.isArray(value)||value.length>2)fail('allocations');const rows=value.map(a=>{
    if(!exact(a,['slot','use','toolItemId'])||!Number.isSafeInteger(a.slot)||a.slot<1||a.slot>2||!WORKSHOP_FLOOR.uses.includes(a.use)||(a.use==='tool_bench'?typeof a.toolItemId!=='string':a.toolItemId!==null))fail('allocations');
    return{slot:a.slot,use:a.use,toolItemId:a.toolItemId===null?null:id(a.toolItemId)};
  }).sort((a,b)=>a.slot-b.slot);if(new Set(rows.map(a=>a.slot)).size!==rows.length||new Set(rows.map(a=>a.use)).size!==rows.length)fail('duplicate_allocation');return rows;
}
function terms(body){if(!exact(body,['businessId','expectedRevision','allocations','consent'])||body.consent!==true||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||body.expectedRevision>2147483646)fail('terms');return{businessId:id(body.businessId),expectedRevision:body.expectedRevision,allocations:allocations(body.allocations),consent:true};}
function hooks(){
  if(P.workshopFloorAdmission!==assertWorkshopFloorBeforeCraft||D.workshopFloorStorageAdmission!==assertWorkshopFloorStorage||H.workshopFloorStorageAdmission!==assertWorkshopFloorStorage||Premises.workshopFloorLeaseAdmission!==assertWorkshopFloorLease||C.workshopFloorServiceAdmission!==assertWorkshopFloorService)fail('integration_required');
  for(const [m,n]of [[P,'assertWorkshopFloorProductionScope'],[D,'assertWorkshopFloorStorageScope'],[H,'assertWorkshopFloorStorageScope'],[Premises,'assertWorkshopFloorLeaseScope'],[C,'assertWorkshopFloorServiceScope']])if(typeof m[n]!=='function')fail('integration_required');
}
async function current(c,a){const rows=(await c.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2',[a])).rows;if(rows.length!==1)fail('original_actor');return rows[0].id;}
async function actor(c,a){const key=await current(c,a),ch=(await c.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE',[key])).rows[0];if(!ch?.alive||ch.is_npc||ch.account_id!==a||(await c.query('SELECT status FROM accounts WHERE id=$1 FOR UPDATE',[a])).rows[0]?.status!=='active'||await current(c,a)!==ch.id)fail('original_actor');return ch;}
async function business(c,b,a,char){const row=(await c.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE',[b])).rows[0];if(!row||row.status!=='open'||row.owner_character!==char)fail('business');const who=(await c.query('SELECT account_id,alive,is_npc FROM characters WHERE id=$1',[char])).rows[0];if(!who?.alive||who.is_npc||who.account_id!==a||await current(c,a)!==char||(await c.query('SELECT status FROM accounts WHERE id=$1',[a])).rows[0]?.status!=='active')fail('original_actor');return row;}
async function property(c,a,depot){
  const p=(await c.query('SELECT * FROM agent_company_profiles WHERE account_id=$1 FOR UPDATE',[a])).rows[0];if(!p)fail('premises');
  if(p.premises_kind==='estate'){
    const e=(await c.query('SELECT tier FROM estates WHERE account_id=$1 FOR UPDATE',[a])).rows[0];if(!e||!Number.isSafeInteger(Number(e.tier))||Number(e.tier)<1||p.premises_key!==a)fail('premises');
    return{kind:'estate',key:a,district:null};
  }
  if(p.premises_kind==='street'){
    const d=(await c.query('SELECT name_lc,district,onchain_token_id FROM street_deeds WHERE account_id=$1 FOR UPDATE',[a])).rows[0];if(!d||d.onchain_token_id!==null||p.premises_key!==d.name_lc||p.premises_district!==d.district||d.district!==depot.district)fail('premises');return{kind:'street',key:d.name_lc,district:d.district};
  }
  fail('owner_premises_required');
}
async function occupied(c,a,site){
  const now=await clock(c),rows=(await c.query("SELECT * FROM commercial_premises_leases WHERE landlord_account=$1 AND state='active' AND expires_at>$2 ORDER BY offer_id,slot LIMIT 3 FOR UPDATE",[a,now])).rows,slots=[];if(rows.length>2)fail('paid_occupancy_source');
  for(const r of rows){if(r.premises_kind!==site.kind||r.premises_key!==site.key||r.premises_district!==site.district)continue;
    if(![1,2].includes(Number(r.slot))||slots.includes(Number(r.slot)))fail('paid_occupancy_source');
    const legs=(await c.query("SELECT character_id,currency,amount,reason FROM transactions WHERE counterparty=$1 AND reason IN ('commercial_premises:rent:pay','commercial_premises:rent:receive') ORDER BY reason",[r.id])).rows;
    if(legs.length!==2||legs[0].reason!=='commercial_premises:rent:pay'||legs[1].reason!=='commercial_premises:rent:receive'||legs[0].character_id!==r.tenant_character||legs[0].currency!=='cash'||Number(legs[0].amount)!==-Number(r.rent_cash)||legs[1].character_id!==r.landlord_character||legs[1].currency!=='cash'||Number(legs[1].amount)!==Number(r.rent_cash))fail('paid_occupancy_source');slots.push(Number(r.slot));
  }return slots.sort();
}
function checkPlan(row){
  const s=row?.source_json;if(!s||!exact(s,['businessId','accountId','originalCharacter','revision','premises','allocations','observedAt'])||!exact(s.premises,['kind','key','district'])||!['estate','street'].includes(s.premises.kind)||typeof s.premises.key!=='string'||(s.premises.kind==='estate'?s.premises.district!==null:typeof s.premises.district!=='string')||typeof s.observedAt!=='string'||!Number.isFinite(Date.parse(s.observedAt))||hash(s)!==row.source_hash||s.businessId!==row.business_id||s.accountId!==row.account_id||s.originalCharacter!==row.original_character||s.revision!==Number(row.revision)||stable(allocations(s.allocations))!==stable(row.allocations))fail('plan_source');return row;
}
const dto=p=>({businessId:p.business_id,revision:Number(p.revision),sourceHash:p.source_hash,allocations:p.allocations,premisesKind:p.source_json.premises.kind,capacity:2,productionBonus:0,storageCapacityBonus:0});
async function authored(c,p){
  const r=(await c.query('SELECT * FROM workshop_floor_requests WHERE run_id=$1',[p.id])).rows[0],b=r?.request_json;
  if(!r||r.account_id!==p.account_id||r.account_ref!==p.account_id||r.original_character!==p.original_character||r.business_ref!==p.business_id||!b||r.body_hash!==hash(b)||stable(terms(b))!==stable(b)||b.expectedRevision+1!==Number(p.revision)||stable(r.source_json)!==stable(p.source_json)||stable(r.receipt)!==stable({ok:true,...dto(p)}))fail('plan_receipt');
}
async function bench(c,a,rows){
  const b=rows.find(x=>x.use==='tool_bench');if(!b)return;
  const policy=(await c.query('SELECT kind,tool_item_id FROM company_specializations WHERE business_id=$1 FOR UPDATE',[a.businessId])).rows[0];if(policy?.kind!=='quality'||policy.tool_item_id!==b.toolItemId)fail('quality_bench');
  const item=(await c.query('SELECT template_id,owner_scope,owner_id,state FROM item_instances WHERE id=$1 FOR UPDATE',[b.toolItemId])).rows[0];if(item?.template_id!==WORKSHOP_FLOOR.toolTemplate||item.owner_scope!=='account'||item.owner_id!==a.accountId||item.state!=='active')fail('bench_custody');await assertEquipmentUsable(c,{itemId:b.toolItemId,owner:{scope:'account',id:a.accountId},minimum:80});
  const others=(await c.query("SELECT p.* FROM workshop_floorplans p JOIN business_depots d ON d.id=p.business_id JOIN characters ch ON ch.id=p.original_character WHERE p.account_id=$1 AND p.business_id<>$2 AND d.status='open' AND d.owner_character=p.original_character AND ch.alive=true ORDER BY p.business_id LIMIT 2",[a.accountId,a.businessId])).rows;if(others.length>1)fail('business_limit');if(others.some(p=>p.allocations.some(x=>x.use==='tool_bench'&&x.toolItemId===b.toolItemId)))fail('duplicate_bench');
}
async function storageHolds(c,d){
  const now=await clock(c),reserved=await H.warehouseReservedUnits(c,d.id,now),orders=(await c.query("SELECT qty,filled_qty,status FROM market_listings WHERE depot_id=$1 AND (status='live' OR filled_qty>0)",[d.id])).rows;
  return Number(d.stock)>0||reserved>0||orders.some(r=>Number(r.filled_qty)>0||(r.status==='live'&&Number(r.qty)>0));
}
async function obligations(c,b){
  const funded=(await c.query("SELECT id FROM commissioned_crafting_contracts WHERE business_id=$1 AND status IN ('funded','accepted') ORDER BY id LIMIT 1",[b])).rows;
  const reservations=(await c.query("SELECT id FROM production_slot_reservations WHERE business_id=$1 AND status IN ('offered','active') ORDER BY id LIMIT 1",[b])).rows;return funded.length>0||reservations.length>0;
}
async function source(c,p,{requireBench=false}={}){
  checkPlan(p);await authored(c,p);const d=await business(c,p.business_id,p.account_id,p.original_character),site=await property(c,p.account_id,d);if(stable(site)!==stable(p.source_json.premises))fail('premises_changed');const paid=await occupied(c,p.account_id,site);if(p.allocations.some(a=>paid.includes(a.slot)))fail('paid_occupancy');if(requireBench)await bench(c,{accountId:p.account_id,businessId:p.business_id},p.allocations);return d;
}
export async function configureWorkshopFloor(c,account,body,key){
  I.assertItemTransaction(c);try{id(account);id(key);const t=terms(body),keyHash=hash([account,key]),bodyHash=hash(t),old=(await c.query('SELECT body_hash,receipt FROM workshop_floor_requests WHERE account_id=$1 AND key_hash=$2',[account,keyHash])).rows[0];if(old){if(old.body_hash!==bodyHash)fail('request_conflict');if(!old.receipt)fail('in_progress');return old.receipt;}
    hooks();const run=crypto.randomUUID();I.registerItemTransactionUndo(c,()=>c.query('DELETE FROM workshop_floor_requests WHERE account_id=$1 AND key_hash=$2 AND run_id=$3',[account,keyHash,run]));await c.query('INSERT INTO workshop_floor_requests(account_id,key_hash,body_hash,run_id,request_json) VALUES($1,$2,$3,$4,$5) ON CONFLICT(account_id,key_hash) DO NOTHING',[account,keyHash,bodyHash,run,t]);const reserved=(await c.query('SELECT body_hash,run_id,receipt FROM workshop_floor_requests WHERE account_id=$1 AND key_hash=$2 FOR UPDATE',[account,keyHash])).rows[0];if(reserved.body_hash!==bodyHash)fail('request_conflict');if(reserved.receipt)return reserved.receipt;if(reserved.run_id!==run)fail('in_progress');
    const ch=await actor(c,account),d=await business(c,t.businessId,account,ch.id),site=await property(c,account,d),paid=await occupied(c,account,site),prior=(await c.query('SELECT * FROM workshop_floorplans WHERE business_id=$1 FOR UPDATE',[d.id])).rows[0];if(Number(prior?.revision??0)!==t.expectedRevision)fail('revision');if(t.allocations.some(a=>paid.includes(a.slot)))fail('paid_occupancy');
    if(!t.allocations.some(a=>a.use==='storage')&&await storageHolds(c,d))fail('stored_obligation');if(await obligations(c,d.id)){if(!t.allocations.some(a=>a.use==='service'))fail('funded_obligation');const profile=(await c.query('SELECT kind FROM company_specializations WHERE business_id=$1',[d.id])).rows[0];if(profile?.kind==='quality'&&!t.allocations.some(a=>a.use==='tool_bench'))fail('funded_obligation');}await bench(c,{accountId:account,businessId:d.id},t.allocations);
    const s={businessId:d.id,accountId:account,originalCharacter:ch.id,revision:t.expectedRevision+1,premises:site,allocations:t.allocations,observedAt:(await clock(c)).toISOString()},p={business_id:d.id,id:run,account_id:account,original_character:ch.id,revision:s.revision,source_json:s,source_hash:hash(s),allocations:t.allocations};
    if(prior){I.registerItemTransactionUndo(c,()=>c.query('UPDATE workshop_floorplans SET id=$2,account_id=$3,original_character=$4,revision=$5,source_json=$6,source_hash=$7,allocations=$8 WHERE business_id=$1',[prior.business_id,prior.id,prior.account_id,prior.original_character,prior.revision,prior.source_json,prior.source_hash,JSON.stringify(prior.allocations)]));await c.query('UPDATE workshop_floorplans SET id=$2,account_id=$3,original_character=$4,revision=$5,source_json=$6,source_hash=$7,allocations=$8 WHERE business_id=$1',[p.business_id,p.id,p.account_id,p.original_character,p.revision,p.source_json,p.source_hash,JSON.stringify(p.allocations)]);}else{I.registerItemTransactionUndo(c,()=>c.query('DELETE FROM workshop_floorplans WHERE business_id=$1',[d.id]));await c.query('INSERT INTO workshop_floorplans(business_id,id,account_id,original_character,revision,source_json,source_hash,allocations) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[p.business_id,p.id,p.account_id,p.original_character,p.revision,p.source_json,p.source_hash,JSON.stringify(p.allocations)]);}
    const receipt={ok:true,...dto(p)};if((await c.query('UPDATE workshop_floor_requests SET receipt=$4,source_json=$5,account_ref=$1,original_character=$6,business_ref=$7 WHERE account_id=$1 AND key_hash=$2 AND run_id=$3 AND receipt IS NULL',[account,keyHash,run,receipt,s,ch.id,d.id])).rowCount!==1)fail('receipt');return receipt;
  }catch(e){I.poisonItemTransaction(c,e);throw e;}
}
export async function assertWorkshopFloorBeforeCraft(c,ctx,token){
  I.assertItemTransaction(c);try{await P.assertWorkshopFloorProductionScope(c,ctx,token);const p=(await c.query('SELECT * FROM workshop_floorplans WHERE business_id=$1',[ctx.businessId])).rows[0];if(!p)return null;hooks();if(p.account_id!==ctx.accountId||p.original_character!==ctx.originalCharacter)fail('original_actor');
    const policy=(await c.query('SELECT kind,tool_item_id FROM company_specializations WHERE business_id=$1',[ctx.businessId])).rows[0],quality=policy?.kind==='quality',use=quality?'tool_bench':'service',slot=p.allocations?.find(a=>a.use===use);if(!slot||!WORKSHOP_FLOOR.recipes.includes(ctx.recipeId))fail('production_allocation');await source(c,p,{requireBench:quality});return{revision:Number(p.revision),sourceHash:p.source_hash,slot:slot.slot,use,toolItemId:quality?slot.toolItemId:null,productionBonus:0};
  }catch(e){I.poisonItemTransaction(c,e);throw e;}
}
export async function assertWorkshopFloorStorage(c,ctx,token){
  I.assertItemTransaction(c);try{if(ctx?.operation==='restock')await D.assertWorkshopFloorStorageScope(c,ctx,token);else await H.assertWorkshopFloorStorageScope(c,ctx,token);const p=(await c.query('SELECT * FROM workshop_floorplans WHERE business_id=$1',[ctx.businessId])).rows[0];if(!p)return null;hooks();if(!p.allocations?.some(a=>a.use==='storage'))fail('storage_allocation');await source(c,p);return{sourceHash:p.source_hash,capacity:D.DEPOT.capacity,capacityBonus:0};}catch(e){I.poisonItemTransaction(c,e);throw e;}
}
export async function assertWorkshopFloorService(c,ctx,token){
  I.assertItemTransaction(c);try{await C.assertWorkshopFloorServiceScope(c,ctx,token);const p=(await c.query('SELECT * FROM workshop_floorplans WHERE business_id=$1',[ctx.businessId])).rows[0];if(!p)return null;hooks();if(!p.allocations?.some(a=>a.use==='service'))fail('service_allocation');await source(c,p);return{sourceHash:p.source_hash,capacityBonus:0};}catch(e){I.poisonItemTransaction(c,e);throw e;}
}
export async function assertWorkshopFloorLease(c,ctx,token){
  I.assertItemTransaction(c);try{await Premises.assertWorkshopFloorLeaseScope(c,ctx,token);const rows=(await c.query("SELECT p.* FROM workshop_floorplans p JOIN business_depots d ON d.id=p.business_id WHERE p.account_id=$1 AND p.original_character=$2 AND d.owner_character=$2 AND d.status='open' ORDER BY p.business_id LIMIT 2",[ctx.landlordAccount,ctx.landlordCharacter])).rows;if(rows.length>1)fail('business_limit');for(const p of rows){checkPlan(p);await authored(c,p);if(stable(p.source_json.premises)===stable(ctx.premises)&&p.allocations.some(a=>a.slot===ctx.slot))fail('owner_allocated');}return null;}catch(e){I.poisonItemTransaction(c,e);throw e;}
}
export async function workshopFloorBoard(c,account){id(account);const rows=(await c.query('SELECT * FROM workshop_floorplans WHERE account_id=$1 ORDER BY business_id LIMIT 20',[account])).rows;return{plans:rows.map(dto),supportedUses:WORKSHOP_FLOOR.uses,capacity:2,tenantAuthoredPlans:false};}
export async function collectWorkshopFloorIssues(c){
  const issues=[],rows=(await c.query('SELECT * FROM workshop_floorplans ORDER BY business_id')).rows;for(const p of rows){try{checkPlan(p);await authored(c,p);}catch{issues.push({id:p.business_id,reason:'plan_source'});}}
  const requests=(await c.query('SELECT * FROM workshop_floor_requests ORDER BY account_id,key_hash')).rows;for(const r of requests){try{const b=terms(r.request_json),s=r.source_json;if(r.body_hash!==hash(b)||r.account_ref!==r.account_id||s.accountId!==r.account_id||s.originalCharacter!==r.original_character||s.businessId!==r.business_ref||s.revision!==b.expectedRevision+1||stable(s.allocations)!==stable(b.allocations)||r.receipt?.sourceHash!==hash(s)||r.receipt?.revision!==s.revision)fail('request');}catch{issues.push({id:r.run_id,reason:'request_binding'});}}return issues;
}
