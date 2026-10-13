import { GameError } from './game.js';
import { assertItemTransaction, itemMutationContext, registerItemTransactionUndo,registerItemTransactionBeforeEventUndo,poisonItemTransaction,ownsItemMutationReservation } from './items.js';

export const ITEM_DURABILITY = Object.freeze({ templateId:'item:precision_lock_tool', maximum:100, temperedMaximum:150, useCost:10 });
const fail=reason=>{ throw new GameError('item_durability',reason); };
const id=value=>{ if(typeof value!=='string'||!value.length||value.length>200) fail('identity');return value; };
const TEMPERED='recipe:tempered_precision_lock_tool';
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v);
export const itemDurabilityDDL = `CREATE TABLE IF NOT EXISTS item_durability_states (
 item_id TEXT PRIMARY KEY REFERENCES item_instances(id), creation_event TEXT NOT NULL REFERENCES item_events(id),
 remaining INT NOT NULL CHECK(remaining BETWEEN 0 AND 150), revision INT NOT NULL CHECK(revision>=1));
CREATE TABLE IF NOT EXISTS item_durability_uses (
 event_id TEXT PRIMARY KEY REFERENCES item_events(id), item_id TEXT NOT NULL REFERENCES item_durability_states(item_id),
 instance_id TEXT NOT NULL REFERENCES mystery_instances(id), node_id TEXT NOT NULL,
 mutation_key TEXT NOT NULL, before_condition INT NOT NULL CHECK(before_condition BETWEEN 10 AND 150),
 after_condition INT NOT NULL CHECK(after_condition = before_condition - 10),
 UNIQUE(item_id,instance_id,node_id));
CREATE TABLE IF NOT EXISTS item_durability_birth_quality (
 item_id TEXT PRIMARY KEY REFERENCES item_instances(id), craft_key TEXT NOT NULL UNIQUE REFERENCES item_mutation_guards(idempotency_key),
 creation_event TEXT NOT NULL UNIQUE REFERENCES item_events(id), authority_account TEXT NOT NULL REFERENCES accounts(id),
 request_hash TEXT NOT NULL CHECK(char_length(request_hash)=64), recipe_identity JSONB NOT NULL,
 grade TEXT NOT NULL CHECK(grade='tempered'), maximum INT NOT NULL CHECK(maximum=150));`;

async function physical(client,itemId,owner) {
  const item=(await client.query('SELECT * FROM item_instances WHERE id=$1 FOR UPDATE',[id(itemId)])).rows[0];
  if(!item||item.template_id!==ITEM_DURABILITY.templateId||item.definition_hash!==null) fail('unsupported');
  if(owner&&(item.owner_scope!==owner.scope||item.owner_id!==owner.id||item.state!=='active')) fail('custody');
  const created=(await client.query("SELECT id,template_id,quality FROM item_events WHERE item_id=$1 AND event_kind='created' AND provenance_kind IN ('crafted','salvaged','awarded','imported') ORDER BY sequence LIMIT 2",[item.id])).rows;
  if(created.length!==1||created[0].template_id!==item.template_id||created[0].quality!=='standard') fail('creation');
  const state=(await client.query('SELECT * FROM item_durability_states WHERE item_id=$1 FOR UPDATE',[item.id])).rows[0];
  if(state&&state.creation_event!==created[0].id) fail('creation');
  const certificate=(await client.query('SELECT * FROM item_durability_birth_quality WHERE item_id=$1',[item.id])).rows[0],maximum=certificate?150:100;
  if(certificate&&certificate.creation_event!==created[0].id)fail('creation');
  if(certificate){const witness=await manufacturingWitness(client,certificate.craft_key,item.id,false);if(certificate.request_hash!==witness.guard.request_hash||certificate.authority_account!==witness.guard.owner_id||stable(certificate.recipe_identity)!==stable(witness.recipe))fail('birth_integrity');}
  if(state&&(!Number.isSafeInteger(Number(state.remaining))||Number(state.remaining)<0||Number(state.remaining)>maximum))fail('condition');
  return {item,creationEvent:created[0].id,maximum,remaining:Number(state?.remaining??maximum),revision:Number(state?.revision??0),state};
}
async function assertEquipmentUsableImpl(client,{itemId,owner,mutation,minimum=10}) {
  assertItemTransaction(client);
  if(mutation) { const root=itemMutationContext(client,mutation);if(root.mutationKind!=='mystery_action'||root.owner.scope!==owner.scope||root.owner.id!==owner.id) fail('authority'); }
  if(!Number.isSafeInteger(minimum)||minimum<10||minimum>150) fail('minimum');
  const equipment=await physical(client,itemId,owner);if(equipment.remaining<minimum) fail('broken');
  return {itemId:equipment.item.id,remaining:equipment.remaining,maximum:equipment.maximum};
}
async function recordEquipmentUseImpl(client,{instanceId,nodeId,itemId,eventId,mutation}) {
  const root=itemMutationContext(client,mutation);if(root.mutationKind!=='mystery_action'||nodeId!=='mystery:belladonna-lock') fail('authority');
  const instance=(await client.query('SELECT * FROM mystery_instances WHERE id=$1',[id(instanceId)])).rows[0];
  const node=(await client.query('SELECT * FROM mystery_node_state WHERE instance_id=$1 AND node_id=$2',[instanceId,nodeId])).rows[0];
  if(!instance||instance.graph_id!=='belladonna-demo'||Number(instance.graph_version)!==1||instance.owner_scope!==root.owner.scope||instance.owner_id!==root.owner.id||node?.state!=='completed'||!node.completed_at) fail('completion');
  const account=root.owner.scope==='account'?root.owner.id:(await client.query('SELECT account_id FROM characters WHERE id=$1',[root.owner.id])).rows[0]?.account_id;
  if(!account||instance.authority_account_id!==account) fail('authority');
  const events=(await client.query("SELECT * FROM item_events WHERE item_id=$1 AND idempotency_key=$2 AND event_kind='escrowed' AND provenance_kind='used_in_mystery' AND to_owner_scope='operation' AND to_owner_id=$3 ORDER BY sequence LIMIT 2",[id(itemId),root.key,instance.id])).rows;
  if(events.length!==1||events[0].from_owner_scope!==root.owner.scope||events[0].from_owner_id!==root.owner.id||(eventId!==undefined&&events[0].id!==id(eventId))) fail('use_event');
  const event=events[0];
  const prior=(await client.query('SELECT * FROM item_durability_uses WHERE event_id=$1',[event.id])).rows[0];
  if(prior) { if(prior.item_id!==itemId||prior.instance_id!==instanceId||prior.node_id!==nodeId) fail('replay');return {itemId,replayed:true,remaining:Number(prior.after_condition)}; }
  const equipment=await physical(client,itemId);
  if(equipment.item.owner_scope!=='operation'||equipment.item.owner_id!==instanceId||equipment.item.state!=='escrowed') fail('custody');
  if(equipment.remaining<10) fail('broken');
  if(!equipment.state) {
    await client.query('INSERT INTO item_durability_states(item_id,creation_event,remaining,revision) VALUES($1,$2,$3,1)',[itemId,equipment.creationEvent,equipment.maximum]);
    registerItemTransactionUndo(client,()=>client.query('DELETE FROM item_durability_states WHERE item_id=$1',[itemId]));
  } else registerItemTransactionUndo(client,()=>client.query('UPDATE item_durability_states SET remaining=$2,revision=$3 WHERE item_id=$1',[itemId,equipment.remaining,equipment.revision]));
  const after=equipment.remaining-10;
  const changed=await client.query('UPDATE item_durability_states SET remaining=$2,revision=revision+1 WHERE item_id=$1 AND remaining=$3',[itemId,after,equipment.remaining]);if(changed.rowCount!==1) fail('contention');
  await client.query('INSERT INTO item_durability_uses(event_id,item_id,instance_id,node_id,mutation_key,before_condition,after_condition) VALUES($1,$2,$3,$4,$5,$6,$7)',[event.id,itemId,instanceId,nodeId,root.key,equipment.remaining,after]);
  registerItemTransactionBeforeEventUndo(client,()=>client.query('DELETE FROM item_durability_uses WHERE event_id=$1 AND mutation_key=$2',[event.id,root.key]));
  return {itemId,remaining:after,maximum:equipment.maximum,replayed:false};
}
export async function ownItemDurability(client,accountId,characterId) {
  const rows=(await client.query("SELECT DISTINCT i.id,s.remaining,s.revision,b.maximum,b.grade FROM item_instances i LEFT JOIN item_durability_states s ON s.item_id=i.id LEFT JOIN item_durability_birth_quality b ON b.item_id=i.id JOIN item_events e ON e.item_id=i.id AND e.event_kind='created' AND e.provenance_kind IN ('crafted','salvaged','awarded','imported') WHERE i.template_id=$1 AND i.definition_hash IS NULL AND ((i.owner_scope='account' AND i.owner_id=$2) OR (i.owner_scope='character' AND i.owner_id=$3)) ORDER BY i.id LIMIT 50",[ITEM_DURABILITY.templateId,id(accountId),id(characterId)])).rows;
  return {items:rows.map(r=>({itemId:r.id,remaining:Number(r.remaining??r.maximum??100),maximum:Number(r.maximum??100),manufacturingGrade:r.grade??'standard',revision:Number(r.revision??0),creationQualityUnchanged:true})),repairAvailable:false};
}
export async function collectItemConditionIssues(client) {
  const states=(await client.query('SELECT * FROM item_durability_states ORDER BY item_id')).rows,issues=[];

  for(const state of states) {
    const item=(await client.query('SELECT id,template_id,definition_hash FROM item_instances WHERE id=$1',[state.item_id])).rows[0];
    const created=(await client.query('SELECT * FROM item_events WHERE id=$1',[state.creation_event])).rows[0];
    if(!item||item.template_id!==ITEM_DURABILITY.templateId||item.definition_hash!==null||created?.item_id!==item.id||created.template_id!==item.template_id||created.quality!=='standard'||created.event_kind!=='created'||!['crafted','salvaged','awarded','imported'].includes(created.provenance_kind)) issues.push({itemId:state.item_id,reason:'creation'});
    const birth=(await client.query('SELECT * FROM item_durability_birth_quality WHERE item_id=$1',[state.item_id])).rows[0],maximum=birth?150:100;
    const uses=(await client.query('SELECT u.*,e.sequence FROM item_durability_uses u LEFT JOIN item_events e ON e.id=u.event_id WHERE u.item_id=$1 ORDER BY e.sequence,u.event_id LIMIT 16',[state.item_id])).rows;
    if(uses.length>maximum/10||Number(state.remaining)!==maximum-uses.length*10) issues.push({itemId:state.item_id,reason:'condition_conservation'});
    for(const [index,use] of uses.entries()) {
      if(Number(use.before_condition)!==maximum-index*10||Number(use.after_condition)!==maximum-(index+1)*10)issues.push({itemId:state.item_id,reason:'condition_chain'});
      const event=(await client.query('SELECT * FROM item_events WHERE id=$1',[use.event_id])).rows[0];
      const instance=(await client.query('SELECT * FROM mystery_instances WHERE id=$1',[use.instance_id])).rows[0];
      const node=(await client.query('SELECT state,completed_at FROM mystery_node_state WHERE instance_id=$1 AND node_id=$2',[use.instance_id,use.node_id])).rows[0];
      if(!event||event.item_id!==state.item_id||event.idempotency_key!==use.mutation_key||event.event_kind!=='escrowed'||event.provenance_kind!=='used_in_mystery'||event.to_owner_scope!=='operation'||event.to_owner_id!==use.instance_id||instance?.graph_id!=='belladonna-demo'||Number(instance.graph_version)!==1||use.node_id!=='mystery:belladonna-lock'||node?.state!=='completed'||!node.completed_at) issues.push({itemId:state.item_id,reason:'canonical_use'});
    }
  }
  const births=(await client.query('SELECT * FROM item_durability_birth_quality ORDER BY item_id')).rows;
  for(const birth of births){try{const witness=await manufacturingWitness(client,birth.craft_key,birth.item_id,false);if(birth.request_hash!==witness.guard.request_hash||birth.creation_event!==witness.event.id||birth.authority_account!==witness.guard.owner_id||stable(birth.recipe_identity)!==stable(witness.recipe))throw Error('birth');}catch{issues.push({itemId:birth.item_id,reason:'manufacturing_birth'});}}
  const craftGuards = (await client.query("SELECT idempotency_key,result_json FROM item_mutation_guards WHERE mutation_kind='craft' AND result_json IS NOT NULL ORDER BY idempotency_key")).rows;
  for (const guard of craftGuards) {
    let result; try { result = JSON.parse(guard.result_json); } catch { continue; }
    if (result?.recipe?.recipeId === TEMPERED) for (const output of result.outputs || []) {
      if (!births.some(birth => birth.item_id === output.id && birth.craft_key === guard.idempotency_key)) {
        issues.push({ itemId: output.id, reason: 'manufacturing_birth_missing' });
      }
    }
  }
  return issues;
}
async function manufacturingWitness(client,requestKey,itemId,atBirth) {
  const C=await import('./crafting.js'),canonical=C.canonicalCraftAuthority(TEMPERED);
  const guard=(await client.query('SELECT * FROM item_mutation_guards WHERE idempotency_key=$1',[id(requestKey)])).rows[0];
  let result;try{result=JSON.parse(guard?.result_json);}catch{fail('birth_guard');}
  if(!guard||guard.mutation_kind!=='craft'||guard.owner_scope!=='account'||!guard.completed_at||guard.request_hash!==C.canonicalCraftRequestHash(TEMPERED,guard.owner_id)||result?.kind!=='craft'||stable(result.recipe)!==stable(canonical.recipe)||result.cashCost!==0||canonical.cashCost!==0)fail('birth_guard');
  if(!Array.isArray(result.inputs)||result.inputs.length!==2||!Array.isArray(result.outputs)||result.outputs.length!==1||result.outputs[0].id!==itemId||result.outputs[0].templateId!==ITEM_DURABILITY.templateId)fail('birth_result');
  const expected=[{templateId:'mat:hardened_steel',quantity:2,quality:'standard'},{templateId:'mat:salvage_parts',quantity:4,quality:'standard'}];
  for(const input of expected){const actual=result.inputs.filter(r=>r.templateId===input.templateId);if(actual.length!==1||actual[0].quality!=='standard'||actual[0].delta!==-input.quantity)fail('birth_inputs');}
  const events=(await client.query('SELECT * FROM item_events WHERE idempotency_key=$1 ORDER BY sequence LIMIT 4',[requestKey])).rows;
  const created=events.filter(e=>e.event_kind==='created'&&e.item_id===itemId);
  if(events.length!==3||created.length!==1)fail('birth_events');const event=created[0];
  if(event.provenance_kind!=='crafted'||event.template_id!==ITEM_DURABILITY.templateId||event.quality!=='standard'||event.to_owner_scope!=='account'||event.to_owner_id!==guard.owner_id)fail('birth_event');
  for(const input of expected){const consumed=events.filter(e=>e.event_kind==='stack_consumed'&&e.template_id===input.templateId);if(consumed.length!==1||Number(consumed[0].quantity_delta)!==-input.quantity||consumed[0].quality!=='standard'||consumed[0].from_owner_scope!=='account'||consumed[0].from_owner_id!==guard.owner_id)fail('birth_input_events');}
  const item=(await (atBirth?client.query('SELECT * FROM item_instances WHERE id=$1 FOR UPDATE',[id(itemId)]):client.query('SELECT * FROM item_instances WHERE id=$1',[id(itemId)]))).rows[0];
  if(!item||item.template_id!==ITEM_DURABILITY.templateId||item.definition_hash!==null||(atBirth&&(item.owner_scope!=='account'||item.owner_id!==guard.owner_id||item.state!=='active')))fail('birth_item');
  if(atBirth){const history=(await client.query('SELECT id FROM item_events WHERE item_id=$1 ORDER BY sequence LIMIT 2',[itemId])).rows;if(history.length!==1||history[0].id!==event.id)fail('not_birth');}
  return {guard,event,recipe:canonical.recipe};
}
export async function recordManufacturedQuality(client,ctx) {
  assertItemTransaction(client);
  try {
    if(!ctx||Array.isArray(ctx)||Object.keys(ctx).sort().join(',')!=='itemId,requestKey')fail('birth_terms');
    const {requestKey,itemId}=ctx;
    const prior=(await client.query('SELECT * FROM item_durability_birth_quality WHERE item_id=$1',[id(itemId)])).rows[0];
    if(prior){if(prior.craft_key!==requestKey)fail('birth_replay');const witness=await manufacturingWitness(client,requestKey,itemId,false);if(prior.request_hash!==witness.guard.request_hash||prior.creation_event!==witness.event.id||prior.authority_account!==witness.guard.owner_id||stable(prior.recipe_identity)!==stable(witness.recipe))fail('birth_integrity');return {itemId,grade:'tempered',maximum:150,replayed:true};}
    if(!await ownsItemMutationReservation(client,requestKey))fail('fresh_birth_required');
    const witness=await manufacturingWitness(client,requestKey,itemId,true);
    if((await client.query('SELECT item_id FROM item_durability_states WHERE item_id=$1',[itemId])).rows.length)fail('existing_condition');
    await client.query("INSERT INTO item_durability_birth_quality(item_id,craft_key,creation_event,authority_account,request_hash,recipe_identity,grade,maximum) VALUES($1,$2,$3,$4,$5,$6,'tempered',150)",[itemId,requestKey,witness.event.id,witness.guard.owner_id,witness.guard.request_hash,JSON.stringify(witness.recipe)]);
    registerItemTransactionBeforeEventUndo(client,()=>client.query('DELETE FROM item_durability_birth_quality WHERE item_id=$1 AND craft_key=$2 AND creation_event=$3',[itemId,requestKey,witness.event.id]));
    return {itemId,grade:'tempered',maximum:150,replayed:false};
  }catch(error){poisonItemTransaction(client,error);throw error;}
}
export async function recordEquipmentUse(client,ctx) {
  assertItemTransaction(client);try{return await recordEquipmentUseImpl(client,ctx);}catch(error){poisonItemTransaction(client,error);throw error;}
}
export async function assertEquipmentUsable(client,ctx) {
  assertItemTransaction(client);try{return await assertEquipmentUsableImpl(client,ctx);}catch(error){poisonItemTransaction(client,error);throw error;}
}
