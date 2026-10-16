import assert from 'node:assert/strict';
export async function runEquipmentRecoveryScenario({native=false}={}){
Object.assign(process.env,{DEPOT_PILOT:'on',RESOURCE_ECONOMY:'off',RATE_LIMIT:'off',SOCIAL_VERIFY_MODE:'off',INVITE_MODE:'off',JWT_SECRET:'equipment-recovery-fixture-only',MARKET_SEED:'equipment-recovery-fixture-only',MOD_KEY:'equipment-recovery-fixture-only',LEGAL_OPERATOR_NAME:'CI Test Operator',LEGAL_POSTAL_ADDRESS:'123 Fixture Street, Test City',PRIVACY_CONTACT_EMAIL:'privacy@example.test',DMCA_AGENT_NAME:'CI Test Agent',DMCA_AGENT_EMAIL:'copyright@example.test',DMCA_AGENT_ADDRESS:'123 Fixture Street, Test City',DMCA_AGENT_PHONE:'+1 202 555 0100',DMCA_AGENT_REGISTERED:'true',PAYMENT_REFUND_POLICY:'Test fixture policy; not a production policy.'});
const {makeDb}=await import('../src/db.js'),I=await import('../src/items.js'),C=await import('../src/crafting.js'),M=await import('../src/mysteries.js'),Q=await import('../src/itemdurability.js'),R=await import('../src/equipmentrecovery.js'),G=await import('../src/game.js'),D=await import('../src/depot.js');
const {loadGraphPackages}=await import('../src/worldgraph.js'),{PHASE1_WORLD_GRAPH_PACKAGES}=await import('../src/content/phase1.js');
const registry=loadGraphPackages(PHASE1_WORLD_GRAPH_PACKAGES),{buildServer}=await import('./server-fixture.js'),app=await buildServer(),pool=app.pool,tx=fn=>I.withItemTransaction(pool,fn);
const {collectEquipmentRecoveryIssues}=await import('../src/equipmentrecoveryhistory.js');
const nativeSnapshot=native?(await import('../tools/rc1-native-proof.js')).canonicalDatabaseSnapshot:null;
assert.equal((await import('../src/db.js')).dbCaps.skipLocked,native,'Use the explicitly selected real backend');
try{
  assert.deepEqual((await pool.query('SELECT * FROM equipment_recovery_requests')).rows,[],'Actual canonical DDL, no fixture table');
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
  await assert.rejects(tx(c=>C.craftWorldGraphRecipe(c,{accountId:accountOwner.id},R.EQUIPMENT_RECOVERY.recipeId,'generic-recovery-bypass')),e=>e.code==='recovery_required');
  const state=async()=>{const out={};for(const table of ['item_instances','item_stacks','item_events','item_mutation_guards','equipment_recovery_requests','item_durability_states','item_durability_uses','characters','business_depots','transactions'])out[table]=(await pool.query('SELECT * FROM '+table)).rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));return out;};
  const before=await state(),nativeBefore=native?await nativeSnapshot(pool):null;
  const attempts=[],{observePool}=await import('./manufacturinglicenses-native-fixture.js');
  const observed=observePool(pool,async(_c,sql,parameters,result)=>{if(!/^\s*INSERT INTO item_events\b/.test(sql||''))return;assert.equal(result.rowCount,1);attempts.push({kind:parameters[2],template:parameters[5],quantity:parameters[7]});});
  await assert.rejects(I.withItemTransaction(observed,async c=>{await R.recoverEquipment(c,accountOwner.id,terms,'late-recovery');throw Error('actual recovery late failure');}),/actual recovery late failure/);
  assert.deepEqual(attempts,[{kind:'consumed',template:'item:precision_lock_tool',quantity:null},{kind:'stack_granted',template:'mat:salvage_parts',quantity:1}],'Exactly two genuine event/allocator insertions were attempted');
  assert.deepEqual(await state(),before,'Every touched row compensates after real consume+material output');
  if(native){const after=await nativeSnapshot(pool);assert.deepEqual(after.tables,nativeBefore.tables,'Every native table rolls back');assert.deepEqual(after.sequences,nativeBefore.sequences.map(row=>row.sequencename==='item_events_sequence_seq'?{...row,last_value:String(BigInt(row.last_value)+2n)}:row),'Only the two actual consume/grant allocator attempts survive native rollback');}
  const outcomes=await Promise.all([tx(c=>R.recoverEquipment(c,accountOwner.id,terms,'recover-once')),tx(c=>R.recoverEquipment(c,accountOwner.id,terms,'recover-once'))]);
  assert.deepEqual(outcomes[0],outcomes[1]);assert.equal(outcomes[0].destroyed,true);assert.deepEqual(outcomes[0].recovered,{templateId:'mat:salvage_parts',quantity:1,quality:'standard'});
  assert.equal((await pool.query('SELECT state FROM item_instances WHERE id=$1',[itemId])).rows[0].state,'consumed');assert.equal((await pool.query('SELECT * FROM equipment_recovery_requests')).rows.length,1);
  const part=(await pool.query("SELECT quantity FROM item_stacks WHERE owner_scope='account' AND owner_id=$1 AND template_id='mat:salvage_parts'",[accountOwner.id])).rows[0];assert.equal(Number(part.quantity),1);
  await assert.rejects(tx(c=>R.recoverEquipment(c,accountOwner.id,terms,'no-resurrection')),e=>e.code==='equipment_recovery_title');
  await assert.rejects(tx(c=>R.recoverEquipment(c,accountOwner.id,{...terms,sourceHash:'0'.repeat(64)},'recover-once')),e=>e.code==='equipment_recovery_request_conflict');
  assert.deepEqual(await Q.collectItemConditionIssues(pool),[]);
  assert.deepEqual(await collectEquipmentRecoveryIssues({query(sql,...args){assert.match(sql,/^SELECT\b/);return pool.query(sql,...args);}}),[]);
  const saved=(await pool.query('SELECT receipt FROM equipment_recovery_requests WHERE item_id=$1',[itemId])).rows[0].receipt;
  for(const corrupt of [{...saved,sourceHash:'0'.repeat(64)},{...saved,recovered:{...saved.recovered,quantity:2}},{...saved,originalCharacterId:'foreign-original'},{...saved,destroyed:false}]){await pool.query('UPDATE equipment_recovery_requests SET receipt=$2 WHERE item_id=$1',[itemId,corrupt]);assert((await collectEquipmentRecoveryIssues(pool)).length,'Corrupt historical receipt must be refused');}await pool.query('UPDATE equipment_recovery_requests SET receipt=$2 WHERE item_id=$1',[itemId,saved]);
  const condition=(await pool.query('SELECT remaining FROM item_durability_states WHERE item_id=$1',[itemId])).rows[0].remaining;await pool.query('UPDATE item_durability_states SET remaining=remaining+10 WHERE item_id=$1',[itemId]);assert((await collectEquipmentRecoveryIssues(pool)).length);await pool.query('UPDATE item_durability_states SET remaining=$2 WHERE item_id=$1',[itemId,condition]);
  const token=agent=>app.jwt.sign({sub:accountOwner.id,agent});
  const openapi=(await app.inject({method:'GET',url:'/openapi.json'})).json();for(const method of['get','post'])assert(openapi.paths['/v1/equipment-recovery'][method]);
  for(const agent of[false,true]){const replay=await app.inject({method:'POST',url:'/v1/equipment-recovery',headers:{authorization:'Bearer '+token(agent),'idempotency-key':'recover-once'},payload:terms});assert.equal(replay.statusCode,200,replay.body);assert.deepEqual(replay.json(),outcomes[0]);}
  const buyerAccount='recovery-wear-0',buyerCharacter=buyerAccount+'-actor',sellerToken=token(false),buyerToken=app.jwt.sign({sub:buyerAccount,agent:false});
  const call=(jwt,url,payload,key)=>app.inject({method:'POST',url,headers:{authorization:'Bearer '+jwt,'idempotency-key':key},payload});
  const acquisition='/v1/company/acquisitions',quoteBody={depotId:business,buyerCharacter};
  let quoted=await call(sellerToken,acquisition+'/quote',quoteBody,'recovery-title-quote');assert.equal(quoted.statusCode,200,quoted.body);
  await pool.query('UPDATE equipment_recovery_requests SET receipt=$2 WHERE item_id=$1',[itemId,{...saved,sourceHash:'0'.repeat(64)}]);
  const refused=await call(sellerToken,acquisition+'/quote',quoteBody,'recovery-corrupt-history-quote');assert.equal(refused.statusCode,400,refused.body);assert.equal(refused.json().message,'equipment_recovery_history_changed');
  await pool.query('UPDATE equipment_recovery_requests SET receipt=$2 WHERE item_id=$1',[itemId,saved]);
  quoted=await call(sellerToken,acquisition+'/quote',quoteBody,'recovery-title-quote-restored');assert.equal(quoted.statusCode,200,quoted.body);
  const offered=await call(sellerToken,acquisition,{...quoteBody,price:10000,sourceHash:quoted.json().sourceHash,expiresInSeconds:600,consent:true},'recovery-title-offer');assert.equal(offered.statusCode,200,offered.body);
  const offeredId=offered.json().acquisition.id,termsHash=offered.json().acquisition.termsHash;
  const accepted=await call(buyerToken,acquisition+'/'+offeredId+'/accept',{consent:true,maxPrice:10000,termsHash},'recovery-title-accept');assert.equal(accepted.statusCode,200,accepted.body);
  const executed=await call(sellerToken,acquisition+'/'+offeredId+'/execute',{termsHash},'recovery-title-execute');assert.equal(executed.statusCode,200,executed.body);assert.equal(executed.json().acquisition.ownershipTransferred,true);
  assert.equal((await pool.query('SELECT owner_character FROM business_depots WHERE id=$1',[business])).rows[0].owner_character,buyerCharacter);
  const saleLegs=(await pool.query("SELECT character_id,amount FROM transactions WHERE counterparty=$1 AND reason IN ('company_acquisition:pay','company_acquisition:receive') ORDER BY reason",[offeredId])).rows;
  assert.deepEqual(saleLegs.map(r=>[r.character_id,Number(r.amount)]),[[buyerCharacter,-10000],[accountOwner.id+'-actor',10000]],'Actual paid title transfer preserves its two original cash legs');
  assert.deepEqual((await pool.query('SELECT receipt FROM equipment_recovery_requests WHERE item_id=$1',[itemId])).rows[0].receipt,saved,'Title transfer rewrites no original recovery history');
  const oldAck=await call(sellerToken,'/v1/equipment-recovery',terms,'recover-once');assert.equal(oldAck.statusCode,200,oldAck.body);assert.deepEqual(oldAck.json(),outcomes[0]);
  const {runEstate}=await import('../src/social/estate.js');
  await G.withTwoCharacters(pool,buyerAccount,terms.originalCharacterId,(_actor,victim,c,h)=>runEstate(c,h,victim,'N14 original recovery account estate'),{meet:false});
  assert.equal((await pool.query('SELECT alive FROM characters WHERE id=$1',[terms.originalCharacterId])).rows[0].alive,false);
  const heir=(await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true',[accountOwner.id])).rows;
  assert.equal(heir.length,1);assert.notEqual(heir[0].id,terms.originalCharacterId);
  const estateState=await state();assert.deepEqual(await tx(c=>R.recoverEquipment(c,accountOwner.id,terms,'recover-once')),outcomes[0]);
  await assert.rejects(tx(c=>R.recoverEquipment(c,accountOwner.id,terms,'heir-no-resurrection')),e=>e.code==='crafting_unavailable');
  assert.deepEqual(await state(),estateState,'Actual heir gets history without an item, material, authority or cash effect');
  assert.deepEqual(await collectEquipmentRecoveryIssues(pool),[]);
  const {runLedgerInvariants}=await import('../src/invariants.js');const books=await runLedgerInvariants(pool,{alert:false});assert(books.ok,JSON.stringify(books));
  console.log('PASS N14 actual8 Mystery uses, authored exactUID consume/onepart recovery, no cash/resurrection/generic bypass, exact concurrent replay, late full rollback, history corruption refusals, registered human/agent replay and global books. Backend '+(native?'PostgreSQL':'memory'));
}finally{await app.close();}

}
