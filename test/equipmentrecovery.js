import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv';
assert(!process.env.DATABASE_URL,'No ambient database endpoint');
assert(!process.argv.includes('--postgres'),'Native qualification requires root lease and actual shared canonical adapter.');
process.env.DEPOT_PILOT='on';
const {makeDb}=await import('../src/db.js'),I=await import('../src/items.js'),C=await import('../src/crafting.js'),G=await import('../src/game.js'),D=await import('../src/depot.js'),R=await import('../src/equipmentrecovery.js');
const {EQUIPMENT_RECOVERY_INSPECTION}=await import('../src/equipmentrecovery-contracts.js');
const {EQUIPMENT_RECOVERY_PACKAGE}=await import('../docs/equipment-recovery-authored-proposal.mjs');
const pool=await makeDb(),tx=fn=>I.withItemTransaction(pool,fn),read=fn=>I.withItemRead(pool,fn),owner={scope:'account',id:'recover-maker'},customer={scope:'account',id:'recover-customer'};
try{
  assert((await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name='equipment_recovery_requests'")).rows.length, 'Canonical schema installs recovery metadata');
  const actors={};
  for(const account of ['recover-maker','recover-customer']){
    const actor=account+'-actor';actors[account]=actor;
    await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)',[account,'equipment-recovery-component']);
    await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$1,1,'foundry',10000,20000)",[actor,account]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)',[account]);
    await pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network')",[actor]);
    await G.ledger(pool,{characterId:actor,currency:'cash',amount:19500,reason:'crime:equipment-recovery-fixture'});
  }
  const businesses={};for(const account of Object.keys(actors))businesses[account]=(await G.withCharacter(pool,account,(ch,c,h)=>D.openDepot(ch,{salePrice:600,bidPrice:500,targetStock:2,reorderAt:0,restockBudget:2000},c,h))).id;
  // Explicit fixture resource seeds; positive source proof is the REAL canonical craft and
  // its consumed resource events, not a fabricated tool creation/condition/completion row.
  await tx(async c=>{await I.grantStack(c,owner,'mat:hardened_steel',3,'standard','explicit recovery test inputs','recovery-steel');await I.grantStack(c,owner,'mat:salvage_parts',6,'standard','explicit recovery test inputs','recovery-parts');});
  const made=await tx(c=>C.craftWorldGraphRecipe(c,{accountId:owner.id},'recipe:precision_lock_tool','recovery-standard')),itemId=made.outputs[0].id;
  const inspect=account=>read(c=>R.inspectEquipmentRecovery(c,account,businesses[account],itemId));
  let preview=await inspect(owner.id);assert.equal(preview.remaining,100);assert.equal(preview.eligible,false);
  const validate=new Ajv({strict:false}).compile(EQUIPMENT_RECOVERY_INSPECTION);assert(validate(preview),JSON.stringify(validate.errors));
  const terms={businessId:preview.businessId,itemId,originalCharacterId:preview.originalCharacterId,sourceHash:preview.sourceHash,consent:true};
  await assert.rejects(tx(c=>R.lockEquipmentRecoverySource(c,owner.id,terms)),e=>e.code==='equipment_recovery_healthy');
  await tx(c=>I.transferItem(c,owner,customer,itemId,'canonical fixture title transfer','recovery-title-transfer'));
  await assert.rejects(inspect(owner.id),e=>e.code==='equipment_recovery_title');
  preview=await inspect(customer.id);assert.equal(preview.itemId,itemId);assert.equal(preview.eligible,false);assert.notEqual(preview.sourceHash,terms.sourceHash);
  assert(!JSON.stringify(preview).includes(owner.id),'Public source preview does not reveal original maker account');
  await tx(c=>I.transferItem(c,customer,{scope:'character',id:actors[customer.id]},itemId,'explicit canonical current character title fixture','recovery-character-title'));
  await assert.rejects(inspect(customer.id),e=>e.code==='equipment_recovery_title');
  await tx(c=>I.transferItem(c,{scope:'character',id:actors[customer.id]},customer,itemId,'explicit canonical account title fixture','recovery-account-title'));
  await pool.query("UPDATE characters SET loc='docks' WHERE id=$1",[actors[customer.id]]);
  await assert.rejects(inspect(customer.id),e=>e.code==='equipment_recovery_business');
  await pool.query("UPDATE characters SET loc='foundry' WHERE id=$1",[actors[customer.id]]);
  const before=await pool.query('SELECT * FROM item_events ORDER BY sequence');
  await assert.rejects(tx(c=>R.recoverEquipment(c,customer.id,{businessId:preview.businessId,itemId,originalCharacterId:preview.originalCharacterId,sourceHash:preview.sourceHash,consent:true},'healthy-refusal')),e=>e.code==='equipment_recovery_healthy');
  assert.deepEqual((await pool.query('SELECT * FROM item_events ORDER BY sequence')).rows,before.rows);
  assert.equal((await pool.query('SELECT * FROM equipment_recovery_requests')).rows.length,0);
  const awarded=await tx(c=>I.createItem(c,customer,'item:precision_lock_tool','awarded','recovery-awarded'));
  await assert.rejects(read(c=>R.inspectEquipmentRecovery(c,customer.id,businesses[customer.id],awarded.id)),e=>e.code==='equipment_recovery_origin');
  const tempered=await tx(c=>C.craftWorldGraphRecipe(c,{accountId:owner.id},'recipe:tempered_precision_lock_tool','recovery-tempered'));
  await assert.rejects(read(c=>R.inspectEquipmentRecovery(c,owner.id,businesses[owner.id],tempered.outputs[0].id)),e=>e.code==='equipment_recovery_unsupported_grade');
  const recipe=EQUIPMENT_RECOVERY_PACKAGE.nodes[0];assert.equal(recipe.consumes.length,1);assert.equal(recipe.consumes[0].quantity,1);assert.deepEqual(recipe.produces,[{templateId:'mat:salvage_parts',quantity:1,quality:'standard'}]);
  assert.equal(C.canonicalCraftAuthority('recipe:precision_lock_tool').consumes.find(e=>e.templateId==='mat:salvage_parts').quantity-recipe.produces[0].quantity,1);
  assert.equal(C.canonicalCraftAuthority(recipe.id).recipe.recipeId,recipe.id);
  await assert.rejects(tx(c=>C.craftWorldGraphRecipe(c,{accountId:customer.id},recipe.id,'generic-recovery-refusal')),e=>e.code==='recovery_required');
  for(const invalid of [{...terms,consent:false},{...terms,itemId:''},{...terms,sourceHash:'unknown'},{...terms,quantity:2}])assert.throws(()=>R.equipmentRecoveryTerms(invalid));
  console.log('PASS N14 actual standard craft provenance/current transferred title/healthy+award+tempered refusal/closed generic path/material ratio.');
}finally{await pool.end();}
