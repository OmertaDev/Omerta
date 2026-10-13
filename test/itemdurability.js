import assert from 'node:assert/strict';
assert(!process.env.DATABASE_URL);const native=process.argv.includes('--postgres');
if(native){const u=new URL(process.env.ITEM_DURABILITY_TEST_DATABASE_URL);assert(['postgres:','postgresql:'].includes(u.protocol));assert.equal(u.hostname,'127.0.0.1');assert(!u.search&&!u.hash);assert(/^\/item_durability_[a-z0-9_]+$/.test(u.pathname));const local=['35439','35449'].includes(u.port)&&u.username==='pilot_runner'&&!u.password,ci=u.port==='5432'&&u.username==='postgres'&&u.password==='pgcheck';assert(local||ci);const {default:pg}=await import('pg'),p=new pg.Pool({connectionString:u.href});try{assert.match((await p.query('SHOW server_version')).rows[0].server_version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);assert.equal((await p.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0);}finally{await p.end();}process.env.DATABASE_URL=u.href;}
const {makeDb}=await import('../src/db.js'),I=await import('../src/items.js'),Q=await import('../src/itemdurability.js'),C=await import('../src/crafting.js');
const pool=await makeDb(),tx=fn=>I.withItemTransaction(pool,fn),owner={scope:'account',id:'wear-a'};
try{
await pool.query(Q.itemDurabilityDDL);
for(const [a,c]of [['wear-a','wear-c'],['other-a','other-c'],['rollback-a','rollback-c']]){await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)',[a,'test']);await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$1,1,'foundry',10000,10000)",[c,a]);await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)',[a]);await pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network')",[c]);}
await tx(async c=>{await I.grantStack(c,owner,'mat:hardened_steel',1,'standard','condition fixture inputs','wear-steel');await I.grantStack(c,owner,'mat:salvage_parts',2,'standard','condition fixture inputs','wear-parts');});
const craft=await tx(c=>C.craftWorldGraphRecipe(c,{accountId:'wear-a'},'recipe:precision_lock_tool','wear-canonical-craft')),itemId=craft.outputs[0].id;
assert.equal((await tx(c=>Q.assertEquipmentUsable(c,{itemId,owner}))).remaining,100);
await assert.rejects(tx(c=>Q.assertEquipmentUsable(c,{itemId,owner:{scope:'account',id:'other-a'}})),/custody/);
const creation=(await pool.query("SELECT id,template_id,quality,provenance_kind FROM item_events WHERE item_id=$1 AND event_kind='created'",[itemId])).rows;
// Isolated leaf-boundary fixture: real canonical item escrow under private root;
// completed node metadata stands in only for the coordinator-owned mystery hook.
async function use(instanceId,{complete=true,rollback=false,wearer=owner}={}){
  await pool.query("INSERT INTO mystery_instances(id,owner_scope,owner_id,authority_account_id,graph_id,graph_version) VALUES($1,'account',$2,$2,'belladonna-demo',1)",[instanceId,wearer.id]);
  return tx(c=>I.withItemMutation(c,wearer,'mystery_action','wear-'+instanceId,{itemAuthority:{operations:[instanceId],destinations:[wearer]}},async mutation=>{
    await Q.assertEquipmentUsable(c,{itemId,owner:wearer,mutation});
    await I.escrowItem(c,wearer,instanceId,itemId,'mystery belladonna-demo escrow',mutation,'used_in_mystery');
    if(complete)await c.query("INSERT INTO mystery_node_state(instance_id,node_id,state,discovered_at,completed_at) VALUES($1,'mystery:belladonna-lock','completed',now(),now())",[instanceId]);
    const result=await Q.recordEquipmentUse(c,{instanceId,nodeId:'mystery:belladonna-lock',itemId,mutation});
    const replay=await Q.recordEquipmentUse(c,{instanceId,nodeId:'mystery:belladonna-lock',itemId,mutation});assert(replay.replayed);
    await I.releaseEscrow(c,instanceId,wearer,itemId,'completed tool use release',mutation);
    await c.query("UPDATE mystery_instances SET status='completed',completed_at=now() WHERE id=$1",[instanceId]);
    if(rollback)throw new Error('wear rollback');return result;
  }));
}
assert.equal((await use('wear-one')).remaining,90);assert.deepEqual(await Q.collectItemConditionIssues(pool),[]);
await tx(c=>I.transferItem(c,owner,{scope:'account',id:'other-a'},itemId,'real custody transfer','wear-transfer'));
assert.equal((await Q.ownItemDurability(pool,'wear-a','wear-c')).items.length,0);assert.equal((await Q.ownItemDurability(pool,'other-a','other-c')).items[0].remaining,90);
await assert.rejects(use('wear-cancel',{complete:false,wearer:{scope:'account',id:'other-a'}}),/completion/);assert.equal((await Q.ownItemDurability(pool,'other-a','other-c')).items[0].remaining,90);
await tx(c=>I.transferItem(c,{scope:'account',id:'other-a'},{scope:'account',id:'rollback-a'},itemId,'rollback recipient','wear-transfer-rollback'));
await assert.rejects(use('wear-rollback',{rollback:true,wearer:{scope:'account',id:'rollback-a'}}),/wear rollback/);assert.equal((await Q.ownItemDurability(pool,'rollback-a','rollback-c')).items[0].remaining,90);
assert.deepEqual((await pool.query("SELECT id,template_id,quality,provenance_kind FROM item_events WHERE item_id=$1 AND event_kind='created'",[itemId])).rows,creation,'Immutable creation evidence never changes');
await pool.query('UPDATE item_durability_states SET remaining=100 WHERE item_id=$1',[itemId]);assert((await Q.collectItemConditionIssues(pool)).some(r=>r.reason==='condition_conservation'));await pool.query('UPDATE item_durability_states SET remaining=90 WHERE item_id=$1',[itemId]);
assert.deepEqual(await Q.collectItemConditionIssues(pool),[]);
console.log(`itemdurability ${native?'native':'memory'} PASS: real crafted physical tool/canonical escrow event, completed-node leafbinding, once-only wear, cancellation/rollback, trade-preservedcondition, creationimmutability and independent drift oracle; shared mystery integration not claimed`);
}finally{await pool.end();}
