import assert from 'node:assert/strict';
import {fixture} from './productionbooking-fixture.js';
const f=await fixture(),{pool,tx,B,I,terms,ref,accept,invoke,snapshot,books}=f;
try{
  const baseline=await snapshot();await assert.rejects(tx(c=>f.C.fundCommission(c,'customer',{businessId:f.businesses.maker,feeCash:100,lifetimeSeconds:1200,consent:true},'unbooked-quality')),/quality_source_unsupported/);assert.deepEqual(await snapshot(),baseline);
  const offered=await invoke('offer','maker',terms(),'maker-consent');assert.equal(offered.offer.resourcesHeld,false);
  const pending=await snapshot();assert.deepEqual(await invoke('offer','maker',terms(),'maker-consent'),{...offered,replayed:true});
  await assert.rejects(invoke('accept','other',accept(offered)),/booking_private/);assert.deepEqual(await snapshot(),pending);
  const booked=await invoke('accept','customer',accept(offered),'customer-consent');assert.equal(booked.booking.resourcesHeld,true);
  assert.equal((await pool.query('SELECT status FROM commissioned_crafting_contracts WHERE id=$1',[booked.booking.commissionId])).rows[0].status,'accepted');
  assert.equal((await pool.query('SELECT status FROM production_slot_reservations WHERE id=$1',[booked.booking.reservationId])).rows[0].status,'active');
  const held=await snapshot();
  await assert.rejects(f.configure('maker',[f.service()],1,'held-floor'),/workshop_reserved/);assert.deepEqual(await snapshot(),held);
  await assert.rejects(f.specialize('maker','speed',null,1),/workshop_reserved/);assert.deepEqual(await snapshot(),held);
  await assert.rejects(f.A.setAgentCompany(pool,'maker',{expectedRevision:1,name:'Reassigned',published:false,premises:null}),/premises_reserved/);assert.deepEqual(await snapshot(),held);
  await assert.rejects(f.run('maker','recipe:precision_lock_tool','reserved-unbooked'),/private_booking_scope|production_reserved/);assert.deepEqual(await snapshot(),held);
  const Consignments=await import('../src/consignments.js');await assert.rejects(tx(async c=>{const offer=await Consignments.createConsignment(c,'maker',{itemId:f.tool,hostAccountId:'other',price:101,hostFeeBps:1000,lifetimeSeconds:86400,consent:true},'reserved-tool-escrow');await Consignments.acceptConsignment(c,'other',{consignmentId:offer.consignmentId,sourceHash:offer.sourceHash,consent:true},'reserved-tool-host');}),/tool_reserved/);assert.deepEqual(await snapshot(),held);
  await assert.rejects(tx(c=>B.recordProductionBookingCompletion(c,booked.booking.commissionId,{})),/private_booking_scope/);assert.deepEqual(await snapshot(),held);
  await assert.rejects(tx(c=>B.retireProductionBookingForCommission(c,booked.booking.commissionId,{},{})),/refund_scope/);assert.deepEqual(await snapshot(),held);
  const made=await invoke('complete','maker',ref(offered),'actual-production');assert.equal(made.paidFee,100);assert.equal(made.paidBonusCash,10);assert.equal(made.booking.resourcesHeld,false);
  assert.deepEqual((await pool.query('SELECT template_id,owner_scope,owner_id FROM item_instances WHERE id=$1',[made.outputItemId])).rows[0],{template_id:'item:precision_lock_tool',owner_scope:'account',owner_id:'customer'});
  assert.deepEqual(await invoke('complete','maker',ref(offered),'actual-production'),{...made,replayed:true});
  const row=(await pool.query('SELECT settlement FROM commissioned_crafting_contracts WHERE id=$1',[booked.booking.commissionId])).rows[0],craft=row.settlement.production.crafts[0];assert.equal(craft.admission.kind,'quality');assert.equal(craft.admission.equipmentWear,false);assert.equal(craft.admission.immutableRecipeQuality,true);
  assert.equal(row.settlement.production.totalCrafts,1);assert.equal(row.settlement.production.totalCashCost,0);assert.equal(craft.admission.workshopFloor.toolItemId,f.tool);
  const count=await books();console.log('Production booking actual atomic N03/N09/F01, funded bonus, selective real holds, private-token refusals, unchanged output and immutable replay PASS; '+count+' global checks PASS.');
}finally{await pool.end();}
