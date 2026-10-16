import crypto from 'node:crypto';
const json=x=>typeof x==='string'?JSON.parse(x):x;
const stable=x=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const hash=x=>crypto.createHash('sha256').update(stable(x)).digest('hex'),rawHash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
// Version-one historical request authorities. Never rebind old receipts to current
// owners, liveness, locations, business configuration, code hashes or future recipes.
const recipe=(packageId,recipeId)=>({packageId,packageVersion:1,recipeId,recipeVersion:1});
const originRecipe=recipe('automotive-salvage','recipe:precision_lock_tool'),recoveryRecipe=recipe('equipment-recovery','recipe:recover_worn_precision_tool');
const conditions=[{adapter:'location',value:'foundry'},{adapter:'level',minimumLevel:8},{adapter:'skill',skillId:'fence_network'}];
const parts={templateId:'mat:salvage_parts',quantity:1,quality:'standard'},tool={templateId:'item:precision_lock_tool',quantity:1,quality:'standard'};
const originAuthority={...originRecipe,consumes:[{templateId:'mat:hardened_steel',quantity:1,quality:'standard'},{...parts,quantity:2}],produces:[tool],conditions,cashCost:0};
const recoveryAuthority={...recoveryRecipe,consumes:[tool],produces:[parts],conditions,cashCost:0};
async function birth(c,item){
 const born=(await c.query("SELECT * FROM item_events WHERE item_id=$1 AND event_kind='created' ORDER BY sequence",[item.id])).rows;
 if(born.length!==1)throw Error('creation');const event=born[0],guard=(await c.query('SELECT * FROM item_mutation_guards WHERE idempotency_key=$1',[event.idempotency_key])).rows[0],r=guard?.result_json?json(guard.result_json):null;
 if(event.template_id!==tool.templateId||event.quality!=='standard'||event.provenance_kind!=='crafted'||event.to_owner_scope!=='account'||!guard||guard.mutation_kind!=='craft'||guard.envelope_version!==1||guard.owner_scope!=='account'||guard.owner_id!==event.to_owner_id||!guard.completed_at||guard.request_hash!==rawHash({kind:'craft',owner:{scope:'account',id:guard.owner_id},request:originAuthority})||r?.kind!=='craft'||stable(r.recipe)!==stable(originRecipe)||r.cashCost!==0||r.outputs?.length!==1||r.outputs[0].id!==item.id||r.outputs[0].templateId!==tool.templateId||r.inputs?.length!==2)throw Error('birth_source');
 const events=(await c.query('SELECT * FROM item_events WHERE idempotency_key=$1 ORDER BY sequence',[event.idempotency_key])).rows;
 if(events.length!==3||events.filter(e=>e.id===event.id).length!==1)throw Error('birth_events');
 for(const input of originAuthority.consumes){const es=events.filter(e=>e.event_kind==='stack_consumed'&&e.template_id===input.templateId),rs=r.inputs.filter(v=>v.templateId===input.templateId);if(es.length!==1||es[0].quality!=='standard'||Number(es[0].quantity_delta)!==-input.quantity||es[0].from_owner_scope!=='account'||es[0].from_owner_id!==guard.owner_id||rs.length!==1||rs[0].quality!=='standard'||Number(rs[0].delta)!==-input.quantity)throw Error('birth_inputs');}
 return {creationEventId:event.id,craftKey:event.idempotency_key,requestHash:guard.request_hash,recipe:originRecipe};
}
export async function collectEquipmentRecoveryIssues(c){
 const rows=(await c.query('SELECT * FROM equipment_recovery_requests ORDER BY account_id,key_hash')).rows,issues=[],used=new Set();
 for(const row of rows){try{
  const receipt=json(row.receipt),terms={businessId:row.business_id,itemId:row.item_id,originalCharacterId:row.original_character,sourceHash:receipt?.sourceHash,consent:true};
  if(!exact(receipt,['ok','businessId','itemId','originalCharacterId','sourceHash','recovered','destroyed'])||receipt.ok!==true||receipt.destroyed!==true||receipt.businessId!==row.business_id||receipt.itemId!==row.item_id||receipt.originalCharacterId!==row.original_character||!/^[a-f0-9]{64}$/.test(receipt.sourceHash??'')||stable(receipt.recovered)!==stable({templateId:parts.templateId,quantity:1,quality:'standard'})||!/^[a-f0-9]{64}$/.test(row.key_hash)||row.craft_key!=='equipment-recovery:'+row.key_hash||row.body_hash!==hash(terms))throw Error('receipt');
  if((await c.query('SELECT account_id FROM characters WHERE id=$1',[row.original_character])).rows[0]?.account_id!==row.account_id)throw Error('original_identity');
  const item=(await c.query('SELECT * FROM item_instances WHERE id=$1',[row.item_id])).rows[0];
  if(!item||item.template_id!==tool.templateId||item.definition_hash!==null||item.state!=='consumed'||!item.consumed_at||item.owner_scope!=='account'||item.owner_id!==row.account_id||(await c.query('SELECT item_id FROM operation_escrow WHERE item_id=$1',[item.id])).rows.length||(await c.query('SELECT item_id FROM item_durability_birth_quality WHERE item_id=$1',[item.id])).rows.length)throw Error('consumed_title');
  const origin=await birth(c,item),condition=(await c.query('SELECT * FROM item_durability_states WHERE item_id=$1',[item.id])).rows[0];
  if(!condition||condition.creation_event!==origin.creationEventId||!Number.isSafeInteger(Number(condition.remaining))||Number(condition.remaining)<0||Number(condition.remaining)>20||!Number.isSafeInteger(Number(condition.revision))||Number(condition.revision)<9)throw Error('worn_source');
  const source={businessId:row.business_id,itemId:row.item_id,originalCharacterId:row.original_character,remaining:Number(condition.remaining),maximum:100,revision:Number(condition.revision)};
  if(hash({account:row.account_id,...source,...origin})!==receipt.sourceHash)throw Error('source_hash');
  const guard=(await c.query('SELECT * FROM item_mutation_guards WHERE idempotency_key=$1',[row.craft_key])).rows[0],r=guard?.result_json?json(guard.result_json):null;
  if(!guard||guard.envelope_version!==1||guard.mutation_kind!=='craft'||guard.owner_scope!=='account'||guard.owner_id!==row.account_id||!guard.completed_at||guard.request_hash!==rawHash({kind:'craft',owner:{scope:'account',id:row.account_id},request:{...recoveryAuthority,equipmentRecovery:terms}})||r?.ok!==true||r.kind!=='equipment_recovery'||stable(r.recipe)!==stable(recoveryRecipe)||r.cashCost!==0||r.itemId!==row.item_id||r.businessId!==row.business_id||r.originalCharacterId!==row.original_character||r.sourceHash!==receipt.sourceHash||r.inputs?.length!==1||r.inputs[0].id!==row.item_id||r.inputs[0].state!=='consumed'||r.outputs?.length!==1||r.outputs[0].templateId!==parts.templateId||r.outputs[0].quality!=='standard'||Number(r.outputs[0].delta)!==1||used.has(row.craft_key))throw Error('canonical_guard');
  const events=(await c.query('SELECT * FROM item_events WHERE idempotency_key=$1 ORDER BY sequence',[row.craft_key])).rows,consumed=events.filter(e=>e.event_kind==='consumed'),granted=events.filter(e=>e.event_kind==='stack_granted');
  if(events.length!==2||consumed.length!==1||granted.length!==1||consumed[0].item_id!==row.item_id||consumed[0].template_id!==tool.templateId||consumed[0].quality!=='standard'||consumed[0].provenance_kind!=='consumed'||consumed[0].from_owner_scope!=='account'||consumed[0].from_owner_id!==row.account_id||granted[0].template_id!==parts.templateId||granted[0].quality!=='standard'||Number(granted[0].quantity_delta)!==1||granted[0].to_owner_scope!=='account'||granted[0].to_owner_id!==row.account_id)throw Error('canonical_events');
  used.add(row.craft_key);
 }catch(error){issues.push({id:row.item_id,reason:['receipt','original_identity','consumed_title','creation','birth_source','birth_events','birth_inputs','worn_source','source_hash','canonical_guard','canonical_events'].includes(error.message)?error.message:'history_unknown'});}}
 const guards=(await c.query("SELECT idempotency_key,result_json FROM item_mutation_guards WHERE mutation_kind='craft' ORDER BY idempotency_key")).rows;
 for(const guard of guards){let r;try{r=json(guard.result_json);}catch{}if(r?.kind==='equipment_recovery'&&!used.has(guard.idempotency_key))issues.push({id:guard.idempotency_key,reason:'unbound_recovery'});}
 return issues;
}
