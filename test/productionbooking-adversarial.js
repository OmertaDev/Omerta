import assert from 'node:assert/strict';import {fixture} from './productionbooking-fixture.js';
import {productionBookingAccounting} from '../src/productionbooking-invariants.js';
import {recoverProductionBookingsAtEstateStart} from '../src/productionbooking-estate.js';
const f=await fixture(),{pool,tx,B,terms,ref,accept,invoke,snapshot,books}=f;
async function corrupt(sql,values,restore,args){await pool.query(sql,values);assert((await productionBookingAccounting(pool)).issues.length,'Real history corruption must alarm');await pool.query(restore,args);assert.deepEqual((await productionBookingAccounting(pool)).issues,[]);}
try{
  const offered=await invoke('offer','maker',terms());
  // A pending maker proposal does not hold physical title or another player's
  // capital. Genuine escrow remains available until customer acceptance.
  const Consignments=await import('../src/consignments.js'),sale=await tx(c=>Consignments.createConsignment(c,'maker',{itemId:f.tool,hostAccountId:'other',price:101,hostFeeBps:1000,lifetimeSeconds:86400,consent:true},'pending-consignment'));
  const saleRef={consignmentId:sale.consignmentId,sourceHash:sale.sourceHash,consent:true};await tx(c=>Consignments.acceptConsignment(c,'other',saleRef,'pending-host'));
  const escrowed=await snapshot();await assert.rejects(invoke('accept','customer',accept(offered)),/bench_custody|custody/);assert.deepEqual(await snapshot(),escrowed);await tx(c=>Consignments.cancelConsignment(c,'maker',saleRef,'pending-return'));
  await invoke('cancel','maker',ref(offered));const q=await invoke('offer','maker',terms()),b=await invoke('accept','customer',accept(q));
  const before=await snapshot();await assert.rejects(tx(c=>recoverProductionBookingsAtEstateStart(c,{id:'maker-actor',account_id:'maker'},{estateResolutionScope:{},rentalDeathScope:{}})),e=>e.code==='estate_scope');assert.deepEqual(await snapshot(),before);
  const txrow=(await pool.query("SELECT * FROM transactions WHERE counterparty=$1 AND reason='production_booking:bonus_reserve'",[q.offer.bookingId])).rows[0];
  await corrupt('UPDATE transactions SET reason=$2 WHERE id=$1',[txrow.id,'production_booking:bonus_reserve_extra'],'UPDATE transactions SET reason=$2 WHERE id=$1',[txrow.id,txrow.reason]);
  await corrupt('UPDATE transactions SET currency=$2 WHERE id=$1',[txrow.id,'omr'],'UPDATE transactions SET currency=$2 WHERE id=$1',[txrow.id,'cash']);
  const request=(await pool.query("SELECT * FROM production_booking_requests WHERE action='accept'")).rows[0];await corrupt('UPDATE production_booking_requests SET receipt=$3 WHERE account_id=$1 AND request_key=$2',[request.account_id,request.request_key,{...request.receipt,freeAuthority:true}],'UPDATE production_booking_requests SET receipt=$3 WHERE account_id=$1 AND request_key=$2',[request.account_id,request.request_key,request.receipt]);
  await assert.rejects(tx(c=>B.completeProductionBooking(c,'maker',ref(q),'forged-options',{agentCredential:false,skipQuality:true})),/credential/);
  const made=await invoke('complete','maker',ref(q));const r=(await pool.query('SELECT * FROM production_booking_runs WHERE id=$1',[q.offer.bookingId])).rows[0];
  await corrupt('UPDATE production_booking_runs SET outcome=$2 WHERE id=$1',[r.id,{...r.outcome,outputItemId:f.tool}],'UPDATE production_booking_runs SET outcome=$2 WHERE id=$1',[r.id,r.outcome]);
  const count=await books();console.log('Production booking genuine pending UID escrow/no grief, stale physical custody, forged estate/options, exact closed journal currency/reason, authored receipt and actual output-history negative controls PASS; '+count+' global checks PASS.');
}finally{await pool.end();}
