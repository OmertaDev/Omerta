// N14: verified authored-input recovery. This module never grants materials itself.
import crypto from 'node:crypto';
import { GameError } from './game.js';
import * as Craft from './crafting.js';
import * as Condition from './itemdurability.js';
import * as Items from './items.js';

export const EQUIPMENT_RECOVERY=Object.freeze({ recipeId:'recipe:recover_worn_precision_tool', originRecipeId:'recipe:precision_lock_tool', templateId:'item:precision_lock_tool', maximumCondition:20, material:'mat:salvage_parts', quantity:1 });
const fail=reason=>{throw new GameError('equipment_recovery_'+reason,reason);};
const id=v=>{if(typeof v!=='string'||!/^[!-~]{1,128}$/.test(v))fail('identity');return v;};
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a<b?-1:a>b?1:0)):x);
const hash=v=>crypto.createHash('sha256').update(stable(v)).digest('hex');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export function equipmentRecoveryTerms(body){
  if(!exact(body,['businessId','itemId','originalCharacterId','sourceHash','consent'])||body.consent!==true||!/^[a-f0-9]{64}$/.test(body.sourceHash??''))fail('terms');
  return {businessId:id(body.businessId),itemId:id(body.itemId),originalCharacterId:id(body.originalCharacterId),sourceHash:body.sourceHash,consent:true};
}
// Proof follows canonical creation through legitimate title transfers. No requirement that
// the current rightful account be the original maker; no foreign account is returned publicly.
async function origin(c,item){
  const born=(await c.query("SELECT * FROM item_events WHERE item_id=$1 AND event_kind='created' ORDER BY sequence LIMIT 2",[item.id])).rows;
  if(born.length!==1||born[0].template_id!==EQUIPMENT_RECOVERY.templateId||born[0].quality!=='standard'||born[0].provenance_kind!=='crafted'||born[0].to_owner_scope!=='account')fail('origin');
  const event=born[0],guard=(await c.query('SELECT * FROM item_mutation_guards WHERE idempotency_key=$1',[event.idempotency_key])).rows[0];
  let result;try{result=JSON.parse(guard?.result_json);}catch{fail('origin');}
  const authored=Craft.canonicalCraftAuthority(EQUIPMENT_RECOVERY.originRecipeId);
  if(!guard||guard.mutation_kind!=='craft'||guard.owner_scope!=='account'||guard.owner_id!==event.to_owner_id||!guard.completed_at
    ||guard.request_hash!==Craft.canonicalCraftRequestHash(EQUIPMENT_RECOVERY.originRecipeId,guard.owner_id)
    ||result?.kind!=='craft'||stable(result.recipe)!==stable(authored.recipe)||result.cashCost!==0||authored.cashCost!==0
    ||result.inputs?.length!==2||result.outputs?.length!==1||result.outputs[0].id!==item.id||result.outputs[0].templateId!==item.template_id)fail('origin');
  const inputs=[{templateId:'mat:hardened_steel',quantity:1},{templateId:'mat:salvage_parts',quantity:2}];
  if(stable(authored.consumes.map(v=>({templateId:v.templateId,quantity:Number(v.quantity)})))!==stable(inputs))fail('authored_drift');
  const events=(await c.query('SELECT * FROM item_events WHERE idempotency_key=$1 ORDER BY sequence LIMIT 4',[event.idempotency_key])).rows;
  if(events.length!==3||events.filter(e=>e.id===event.id).length!==1)fail('origin_events');
  for(const input of inputs){
    const consumed=events.filter(e=>e.event_kind==='stack_consumed'&&e.template_id===input.templateId),receipts=result.inputs.filter(e=>e.templateId===input.templateId);
    if(consumed.length!==1||Number(consumed[0].quantity_delta)!==-input.quantity||consumed[0].quality!=='standard'||consumed[0].from_owner_scope!=='account'||consumed[0].from_owner_id!==guard.owner_id
      ||receipts.length!==1||receipts[0].quality!=='standard'||Number(receipts[0].delta)!==-input.quantity)fail('origin_inputs');
  }
  return {creationEventId:event.id,craftKey:event.idempotency_key,requestHash:guard.request_hash,recipe:authored.recipe};
}
async function source(c,account,businessId,itemId,expectedCharacterId,lock){
  id(account);id(businessId);id(itemId);
  const actors=lock?(await c.query('SELECT id,account_id,alive,is_npc,loc FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2 FOR UPDATE',[account])).rows:(await c.query('SELECT id,account_id,alive,is_npc,loc FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2',[account])).rows;
  if(actors.length!==1||actors[0].is_npc||(expectedCharacterId&&actors[0].id!==expectedCharacterId))fail('original_actor');const actor=actors[0];
  const a=(lock?await c.query('SELECT status FROM accounts WHERE id=$1 FOR UPDATE',[account]):await c.query('SELECT status FROM accounts WHERE id=$1',[account])).rows[0];if(a?.status!=='active')fail('account');
  const depot=(lock?await c.query('SELECT id,owner_character,status,district FROM business_depots WHERE id=$1 FOR UPDATE',[businessId]):await c.query('SELECT id,owner_character,status,district FROM business_depots WHERE id=$1',[businessId])).rows[0];
  if(!depot||depot.owner_character!==actor.id||depot.status!=='open'||depot.district!=='foundry'||actor.loc!==depot.district)fail('business');
  const item=(lock?await c.query('SELECT * FROM item_instances WHERE id=$1 FOR UPDATE',[itemId]):await c.query('SELECT * FROM item_instances WHERE id=$1',[itemId])).rows[0];
  if(!item||item.owner_scope!=='account'||item.owner_id!==account||item.state!=='active'||item.template_id!==EQUIPMENT_RECOVERY.templateId||item.definition_hash!==null)fail('title');
  if((await c.query('SELECT item_id FROM operation_escrow WHERE item_id=$1',[itemId])).rows.length)fail('custody');
  if((await c.query('SELECT item_id FROM item_durability_birth_quality WHERE item_id=$1',[itemId])).rows.length)fail('unsupported_grade');
  const proof=await origin(c,item),condition=lock?await Condition.equipmentCondition(c,{itemId,owner:{scope:'account',id:account}}):await Condition.precisionToolConditionRead(c,itemId);
  if(condition.maximum!==100||!Number.isSafeInteger(condition.remaining)||condition.remaining<0||condition.remaining>100)fail('condition');
  const state=(await c.query('SELECT revision FROM item_durability_states WHERE item_id=$1',[itemId])).rows[0];
  const result={businessId,itemId,originalCharacterId:actor.id,remaining:condition.remaining,maximum:100,revision:Number(state?.revision??0)};
  return {...result,sourceHash:hash({account,...result,...proof}),eligible:condition.remaining<=20};
}
export async function inspectEquipmentRecovery(c,account,businessId,itemId){Items.assertItemRead(c);return source(c,account,businessId,itemId,null,false);}
// Root's dedicated canonical crafting leaf calls AFTER its genuine actor mutex and before
// consuming the exact UID. This proof grants no Items mutation/stack mint authority.
export async function lockEquipmentRecoverySource(c,account,terms){
  Items.assertItemTransaction(c);terms=equipmentRecoveryTerms(terms);
  const actual=await source(c,account,terms.businessId,terms.itemId,terms.originalCharacterId,true);
  if(!actual.eligible)fail('healthy');if(actual.sourceHash!==terms.sourceHash)fail('source_changed');return actual;
}
export async function recoverEquipment(c,account,body,key){
  Items.assertItemTransaction(c);id(account);id(key);const terms=equipmentRecoveryTerms(body),keyHash=hash([account,key]),bodyHash=hash(terms);
  const prior=(await c.query('SELECT body_hash,receipt FROM equipment_recovery_requests WHERE account_id=$1 AND key_hash=$2',[account,keyHash])).rows[0];
  if(prior){if(prior.body_hash!==bodyHash)fail('request_conflict');return prior.receipt;}
  if(typeof Craft.recoverWorldGraphEquipment!=='function')fail('canonical_integration_required');
  try {
    const craftKey='equipment-recovery:'+keyHash;
    const result=await Craft.recoverWorldGraphEquipment(c,{accountId:account},terms,craftKey);
    const raced=(await c.query('SELECT body_hash,receipt FROM equipment_recovery_requests WHERE account_id=$1 AND key_hash=$2',[account,keyHash])).rows[0];
    if(raced){if(raced.body_hash!==bodyHash)fail('request_conflict');return raced.receipt;}
    if(result?.kind!=='equipment_recovery'||result.itemId!==terms.itemId||result.originalCharacterId!==terms.originalCharacterId||result.businessId!==terms.businessId||result.sourceHash!==terms.sourceHash||result.cashCost!==0
      ||result.outputs?.length!==1||result.outputs[0].templateId!==EQUIPMENT_RECOVERY.material||Number(result.outputs[0].delta)!==1)fail('canonical_result');
    const events=(await c.query('SELECT * FROM item_events WHERE idempotency_key=$1 ORDER BY sequence LIMIT 3',[craftKey])).rows;
    const consumed=events.filter(e=>e.event_kind==='consumed'&&e.item_id===terms.itemId),granted=events.filter(e=>e.event_kind==='stack_granted'&&e.template_id===EQUIPMENT_RECOVERY.material);
    if(events.length!==2||consumed.length!==1||consumed[0].from_owner_scope!=='account'||consumed[0].from_owner_id!==account||granted.length!==1||Number(granted[0].quantity_delta)!==1||granted[0].quality!=='standard'||granted[0].to_owner_scope!=='account'||granted[0].to_owner_id!==account)fail('canonical_events');
    const item=(await c.query('SELECT state FROM item_instances WHERE id=$1',[terms.itemId])).rows[0];if(item?.state!=='consumed')fail('canonical_consumption');
    const receipt={ok:true,businessId:terms.businessId,itemId:terms.itemId,originalCharacterId:terms.originalCharacterId,sourceHash:terms.sourceHash,recovered:{templateId:EQUIPMENT_RECOVERY.material,quantity:1,quality:'standard'},destroyed:true};
    await c.query('INSERT INTO equipment_recovery_requests(account_id,key_hash,body_hash,original_character,business_id,item_id,receipt,craft_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[account,keyHash,bodyHash,terms.originalCharacterId,terms.businessId,terms.itemId,receipt,craftKey]);
    Items.registerItemTransactionBeforeEventUndo(c,()=>c.query('DELETE FROM equipment_recovery_requests WHERE account_id=$1 AND key_hash=$2 AND craft_key=$3',[account,keyHash,craftKey]));
    return receipt;
  }catch(e){Items.poisonItemTransaction(c,e);throw e;}
}
