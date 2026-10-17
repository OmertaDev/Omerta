import assert from 'node:assert/strict';
import {fixture} from './productionslots-fixture.js';
import {canonicalDatabaseSnapshot} from '../tools/rc1-native-proof.js';
const f=await fixture(),{pool,tx,P,R,funded,specialize,invoke,offerTerms,ref,canonical,commissionTerms,cref,state,books,businesses}=f;
const fundedState=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['reservations','requests'].includes(key)));
const nonMetadata=s=>Object.fromEntries(Object.entries(s.tables).filter(([table])=>!['production_slot_reservations','production_slot_requests'].includes(table)));
try{
  await specialize();await specialize('other',0,'speed');
  const proofStarted=Date.now();
  const q1=await funded(),q2=await funded(),r1=await invoke('maker','offer',offerTerms(q1),'recovery-r1'),r2=await invoke('maker','offer',offerTerms(q2),'recovery-r2');
  const other=await canonical('fundCommission','maker',commissionTerms('other'),'recovery-paid-other');
  await canonical('acceptCommission','other',cref(other),'recovery-other-accept');
  await pool.query("UPDATE accounts SET status='banned' WHERE id='customer'");
  const before=await state();
  const nativeBefore=f.native?await canonicalDatabaseSnapshot(pool):null;
  await assert.rejects(invoke('maker','offer',offerTerms(q1),'recovery-positive-refusal'),e=>e.code==='production_slot'&&e.message==='account');
  await assert.rejects(invoke('customer','release',ref(r1),'recovery-banned-requester'),e=>e.code==='production_slot'&&e.message==='account');
  await assert.rejects(invoke('other','release',ref(r1),'recovery-foreign-requester'),e=>e.code==='production_slot'&&e.message==='party');
  await assert.rejects(invoke('maker','expire',ref(r2),'recovery-early-expiry'),e=>e.code==='production_slot'&&e.message==='deadline');
  assert.deepEqual(await state(),before);
  await assert.rejects(tx(async c=>{await R.productionSlotAction(c,'maker','release',ref(r1),'recovery-release');throw Error('after-real-metadata-release');}),/after-real-metadata-release/);
  assert.deepEqual(await state(),before);
  if(f.native){const after=await canonicalDatabaseSnapshot(pool);assert.deepEqual(after.tables,nativeBefore.tables);assert.deepEqual(after.sequences,nativeBefore.sequences);}
  const released=await invoke('maker','release',ref(r1),'recovery-release');assert.equal(released.status,'released');
  assert.deepEqual(fundedState(await state()),fundedState(before));
  const afterRelease=await state();assert.equal(released.replayed,undefined);assert.deepEqual(await invoke('maker','release',ref(r1),'recovery-release'),{...released,replayed:true});assert.deepEqual(await state(),afterRelease);
  if(f.native){
    assert.equal(+new Date(r2.deadline)-+new Date(r2.readyAt),60000,'Keep the genuine original speed-profile sixty-second reservation');
    while(Date.now()<=+new Date(r2.deadline)+30)await new Promise(resolve=>setTimeout(resolve,Math.max(1,Math.min(1000,+new Date(r2.deadline)+31-Date.now()))));
    assert.equal((await invoke('maker','expire',ref(r2),'recovery-real-expiry')).status,'expired');
    assert(Date.now()-proofStarted>45000,'Expiry proof must cross the genuine original reservation deadline');
    const after=await canonicalDatabaseSnapshot(pool);assert.deepEqual(nonMetadata(after),nonMetadata(nativeBefore));assert.deepEqual(after.sequences,nativeBefore.sequences,'Metadata recovery never advances an item or other sequence');
  }else assert.equal((await invoke('maker','release',ref(r2),'recovery-second-release')).status,'released');
  assert.deepEqual(fundedState(await state()),fundedState(before));
  for(const q of [q1,q2])assert.deepEqual((await pool.query('SELECT status,fee_remaining,fee_paid,fee_refunded FROM commissioned_crafting_contracts WHERE id=$1',[q.commissionId])).rows[0],{status:'accepted',fee_remaining:100,fee_paid:0,fee_refunded:0});
  const fresh=await invoke('other','offer',offerTerms(other),'recovery-fresh-offer');assert.equal((await invoke('maker','confirm',ref(fresh),'recovery-fresh-confirm')).status,'active');
  const reserved=await state();let customEntered=false;
  await assert.rejects(tx(c=>P.runCompanyProduction(c,'other',{businessId:businesses.other,steps:[{recipeId:'recipe:precision_lock_tool',repeat:1}]},'recovery-manual-production',{agentCredential:false,beforeCraft:()=>{customEntered=true;return {productionAuthorized:true};}})),e=>e.code==='production_slot'&&e.message==='reserved_for_commission');
  assert.equal(customEntered,false);assert.deepEqual(await state(),reserved);
  const done=await canonical('completeCommission','other',cref(other),'recovery-actual-completion');assert.equal(done.paidFee,100);assert.equal(done.production.originalCharacterId,'other-actor');
  assert.equal((await pool.query('SELECT status FROM production_slot_reservations WHERE id=$1',[fresh.reservationId])).rows[0].status,'consumed');
  await books();console.log('Original-active metadata recovery with inactive nonrequesting party; positive/requester/foreign/deadline guards, late-fault rollback/replay, funded cash/items/input/profile/cadence preservation, fresh capacity and mandatory F01 guard PASS');
  console.log('Production-slot recovery '+(f.native?'native genuine elapsed expiry PASS':'memory PASS (native genuine elapsed expiry not executed)'));
}finally{await pool.end();}
