// Real canonical Mystery use produces every worn-condition witness. No completion/state seed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
assert(!process.env.DATABASE_URL,'No ambient database endpoint');
assert(!process.argv.includes('--postgres'),'No native lease or integrated recovery adapter qualified.');
process.env.DEPOT_PILOT='on';
const {makeDb}=await import('../src/db.js'),I=await import('../src/items.js'),C=await import('../src/crafting.js'),M=await import('../src/mysteries.js'),Q=await import('../src/itemdurability.js'),R=await import('../src/equipmentrecovery.js'),G=await import('../src/game.js'),D=await import('../src/depot.js');
const {loadGraphPackages}=await import('../src/worldgraph.js'),{PHASE1_WORLD_GRAPH_PACKAGES}=await import('../src/content/phase1.js');
const registry=loadGraphPackages(PHASE1_WORLD_GRAPH_PACKAGES),pool=await makeDb(),tx=fn=>I.withItemTransaction(pool,fn);
try{
  for(let n=0;n<8;n++){
    const account='recovery-wear-'+n,actor=account+'-actor';
    await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)',[account,'equipment-recovery-wear-component']);
    await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$1,1,'foundry',10000,20000)",[actor,account]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)',[account]);
    await pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network')",[actor]);
    await G.ledger(pool,{characterId:actor,currency:'cash',amount:19500,reason:'crime:equipment-recovery-wear-fixture'});
  }
  const maker={scope:'account',id:'recovery-wear-0'};
  await tx(async c=>{await I.grantStack(c,maker,'mat:hardened_steel',1,'standard','explicit recovery input fixture','worn-steel');await I.grantStack(c,maker,'mat:salvage_parts',2,'standard','explicit recovery input fixture','worn-parts');});
  const craft=await tx(c=>C.craftWorldGraphRecipe(c,{accountId:maker.id},'recipe:precision_lock_tool','worn-real-craft')),itemId=craft.outputs[0].id;
  let accountOwner=maker;
  for(let n=0;n<8;n++){
    const account='recovery-wear-'+n,owner={scope:'character',id:account+'-actor'};
    if(n>0){const next={scope:'account',id:account};await tx(c=>I.transferItem(c,accountOwner,next,itemId,'explicit canonical title-transfer fixture','worn-title-'+n));accountOwner=next;}
    await tx(c=>I.transferItem(c,accountOwner,owner,itemId,'explicit current-character assignment fixture','worn-assign-'+n));
    const context=M.createMysteryContext({registry,accountId:account}),graph='belladonna-demo';
    await tx(c=>M.startMystery(c,context,owner,graph,1,'worn-start-'+n));
    await tx(c=>M.completeNode(c,context,owner,graph,'mystery:belladonna-trace',{idempotencyKey:'worn-trace-'+n,interactionId:'inspect_belladonna_stamp'}));
    await tx(c=>M.discoverNode(c,context,owner,graph,'mystery:belladonna-lock',{idempotencyKey:'worn-discover-'+n}));
    await tx(c=>M.completeNode(c,context,owner,graph,'mystery:belladonna-lock',{idempotencyKey:'worn-lock-'+n,interactionId:'set_precision_tumblers'}));
    assert.equal((await pool.query('SELECT remaining FROM item_durability_states WHERE item_id=$1',[itemId])).rows[0].remaining,100-10*(n+1));
    await tx(c=>M.discoverNode(c,context,owner,graph,'mystery:belladonna-file-closed',{idempotencyKey:'worn-end-discover-'+n}));
    await tx(c=>M.completeNode(c,context,owner,graph,'mystery:belladonna-file-closed',{idempotencyKey:'worn-end-'+n,interactionId:'seal_belladonna_file'}));
    await tx(c=>I.transferItem(c,owner,accountOwner,itemId,'explicit account-title reclaim fixture','worn-unassign-'+n));
  }
  const business=(await G.withCharacter(pool,accountOwner.id,(ch,c,h)=>D.openDepot(ch,{salePrice:600,bidPrice:500,targetStock:2,reorderAt:0,restockBudget:2000},c,h))).id;
  // Canonical state is initialized at revision1, then increments for every actual use.
  const preview=await I.withItemRead(pool,c=>R.inspectEquipmentRecovery(c,accountOwner.id,business,itemId));assert.equal(preview.remaining,20);assert.equal(preview.eligible,true);assert.equal(preview.revision,9);
  const terms={businessId:business,itemId,originalCharacterId:preview.originalCharacterId,sourceHash:preview.sourceHash,consent:true};
  assert.deepEqual(await tx(c=>R.lockEquipmentRecoverySource(c,accountOwner.id,terms)),preview);
  assert.equal((await pool.query('SELECT * FROM item_durability_uses WHERE item_id=$1',[itemId])).rows.length,8);
  assert.deepEqual(await Q.collectItemConditionIssues(pool),[]);
  await assert.rejects(tx(c=>C.craftWorldGraphRecipe(c,{accountId:accountOwner.id},R.EQUIPMENT_RECOVERY.recipeId,'actual-worn-generic-refusal')),e=>e.code==='recovery_required');
  assert.equal((await pool.query('SELECT state FROM item_instances WHERE id=$1',[itemId])).rows[0].state,'active');
  assert.equal((await pool.query('SELECT * FROM equipment_recovery_requests')).rows.length,0);
  console.log('PASS N14 real8 Belladonna completions/escrows/releases/100to20/condition oracle/verified transferred title eligible; exact generic recovery path refuses without destroying the selected tool.');
}finally{await pool.end();}
