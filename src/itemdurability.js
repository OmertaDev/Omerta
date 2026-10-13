import { GameError } from './game.js';
import { assertItemTransaction, itemMutationContext, registerItemTransactionUndo,registerItemTransactionBeforeEventUndo } from './items.js';

export const ITEM_DURABILITY = Object.freeze({ templateId:'item:precision_lock_tool', maximum:100, useCost:10 });
const fail=reason=>{ throw new GameError('item_durability',reason); };
const id=value=>{ if(typeof value!=='string'||!value.length||value.length>200) fail('identity');return value; };
export const itemDurabilityDDL = `CREATE TABLE IF NOT EXISTS item_durability_states (
 item_id TEXT PRIMARY KEY REFERENCES item_instances(id), creation_event TEXT NOT NULL REFERENCES item_events(id),
 remaining INT NOT NULL CHECK(remaining BETWEEN 0 AND 100), revision INT NOT NULL CHECK(revision>=1));
CREATE TABLE IF NOT EXISTS item_durability_uses (
 event_id TEXT PRIMARY KEY REFERENCES item_events(id), item_id TEXT NOT NULL REFERENCES item_durability_states(item_id),
 instance_id TEXT NOT NULL REFERENCES mystery_instances(id), node_id TEXT NOT NULL,
 mutation_key TEXT NOT NULL, before_condition INT NOT NULL CHECK(before_condition BETWEEN 10 AND 100),
 after_condition INT NOT NULL CHECK(after_condition = before_condition - 10),
 UNIQUE(item_id,instance_id,node_id));`;

async function physical(client,itemId,owner) {
  const item=(await client.query('SELECT * FROM item_instances WHERE id=$1 FOR UPDATE',[id(itemId)])).rows[0];
  if(!item||item.template_id!==ITEM_DURABILITY.templateId||item.definition_hash!==null) fail('unsupported');
  if(owner&&(item.owner_scope!==owner.scope||item.owner_id!==owner.id||item.state!=='active')) fail('custody');
  const created=(await client.query("SELECT id,template_id,quality FROM item_events WHERE item_id=$1 AND event_kind='created' AND provenance_kind='crafted' ORDER BY sequence LIMIT 2",[item.id])).rows;
  if(created.length!==1||created[0].template_id!==item.template_id||created[0].quality!=='standard') fail('creation');
  const state=(await client.query('SELECT * FROM item_durability_states WHERE item_id=$1 FOR UPDATE',[item.id])).rows[0];
  if(state&&state.creation_event!==created[0].id) fail('creation');
  return {item,creationEvent:created[0].id,remaining:Number(state?.remaining??100),revision:Number(state?.revision??0),state};
}
export async function assertEquipmentUsable(client,{itemId,owner,mutation,minimum=10}) {
  assertItemTransaction(client);
  if(mutation) { const root=itemMutationContext(client,mutation);if(root.mutationKind!=='mystery_action'||root.owner.scope!==owner.scope||root.owner.id!==owner.id) fail('authority'); }
  if(!Number.isSafeInteger(minimum)||minimum<10||minimum>100) fail('minimum');
  const equipment=await physical(client,itemId,owner);if(equipment.remaining<minimum) fail('broken');
  return {itemId:equipment.item.id,remaining:equipment.remaining,maximum:100};
}
export async function recordEquipmentUse(client,{instanceId,nodeId,itemId,eventId,mutation}) {
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
    await client.query('INSERT INTO item_durability_states(item_id,creation_event,remaining,revision) VALUES($1,$2,100,1)',[itemId,equipment.creationEvent]);
    registerItemTransactionUndo(client,()=>client.query('DELETE FROM item_durability_states WHERE item_id=$1',[itemId]));
  } else registerItemTransactionUndo(client,()=>client.query('UPDATE item_durability_states SET remaining=$2,revision=$3 WHERE item_id=$1',[itemId,equipment.remaining,equipment.revision]));
  const after=equipment.remaining-10;
  const changed=await client.query('UPDATE item_durability_states SET remaining=$2,revision=revision+1 WHERE item_id=$1 AND remaining=$3',[itemId,after,equipment.remaining]);if(changed.rowCount!==1) fail('contention');
  await client.query('INSERT INTO item_durability_uses(event_id,item_id,instance_id,node_id,mutation_key,before_condition,after_condition) VALUES($1,$2,$3,$4,$5,$6,$7)',[event.id,itemId,instanceId,nodeId,root.key,equipment.remaining,after]);
  registerItemTransactionBeforeEventUndo(client,()=>client.query('DELETE FROM item_durability_uses WHERE event_id=$1 AND mutation_key=$2',[event.id,root.key]));
  return {itemId,remaining:after,maximum:100,replayed:false};
}
export async function ownItemDurability(client,accountId,characterId) {
  const rows=(await client.query("SELECT DISTINCT i.id,s.remaining,s.revision FROM item_instances i LEFT JOIN item_durability_states s ON s.item_id=i.id JOIN item_events e ON e.item_id=i.id AND e.event_kind='created' AND e.provenance_kind='crafted' WHERE i.template_id=$1 AND i.definition_hash IS NULL AND ((i.owner_scope='account' AND i.owner_id=$2) OR (i.owner_scope='character' AND i.owner_id=$3)) ORDER BY i.id LIMIT 50",[ITEM_DURABILITY.templateId,id(accountId),id(characterId)])).rows;
  return {items:rows.map(r=>({itemId:r.id,remaining:Number(r.remaining??100),maximum:100,revision:Number(r.revision??0),creationQualityUnchanged:true})),repairAvailable:false};
}
export async function collectItemConditionIssues(client) {
  const states=(await client.query('SELECT * FROM item_durability_states ORDER BY item_id LIMIT 1001')).rows,issues=[];
  if(states.length>1000) issues.push({reason:'condition_window'});
  for(const state of states.slice(0,1000)) {
    const item=(await client.query('SELECT id,template_id,definition_hash FROM item_instances WHERE id=$1',[state.item_id])).rows[0];
    const created=(await client.query('SELECT * FROM item_events WHERE id=$1',[state.creation_event])).rows[0];
    if(!item||item.template_id!==ITEM_DURABILITY.templateId||item.definition_hash!==null||created?.item_id!==item.id||created.template_id!==item.template_id||created.quality!=='standard'||created.event_kind!=='created'||created.provenance_kind!=='crafted') issues.push({itemId:state.item_id,reason:'creation'});
    const uses=(await client.query('SELECT u.*,e.sequence FROM item_durability_uses u LEFT JOIN item_events e ON e.id=u.event_id WHERE u.item_id=$1 ORDER BY e.sequence,u.event_id LIMIT 11',[state.item_id])).rows;
    if(uses.length>10||Number(state.remaining)!==100-uses.length*10) issues.push({itemId:state.item_id,reason:'condition_conservation'});
    for(const [index,use] of uses.entries()) {
      if(Number(use.before_condition)!==100-index*10||Number(use.after_condition)!==90-index*10)issues.push({itemId:state.item_id,reason:'condition_chain'});
      const event=(await client.query('SELECT * FROM item_events WHERE id=$1',[use.event_id])).rows[0];
      const instance=(await client.query('SELECT * FROM mystery_instances WHERE id=$1',[use.instance_id])).rows[0];
      const node=(await client.query('SELECT state,completed_at FROM mystery_node_state WHERE instance_id=$1 AND node_id=$2',[use.instance_id,use.node_id])).rows[0];
      if(!event||event.item_id!==state.item_id||event.idempotency_key!==use.mutation_key||event.event_kind!=='escrowed'||event.provenance_kind!=='used_in_mystery'||event.to_owner_scope!=='operation'||event.to_owner_id!==use.instance_id||instance?.graph_id!=='belladonna-demo'||Number(instance.graph_version)!==1||use.node_id!=='mystery:belladonna-lock'||node?.state!=='completed'||!node.completed_at) issues.push({itemId:state.item_id,reason:'canonical_use'});
    }
  }
  return issues;
}
