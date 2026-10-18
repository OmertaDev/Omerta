import assert from 'node:assert/strict';
import {fixture} from './productionbooking-fixture.js';
import {inspectProductionBookingBusinessHistory} from '../src/productionbooking-invariants.js';
import {assertDepotFeatureObligations} from '../src/depotacquisitionruntime.js';

// Genuine existing fixture actions only. --postgres retains the original N13
// strict-fresh admission; no alternative endpoint or fake native backend.
const f=await fixture(),{pool,tx,terms,ref,accept,invoke,snapshot,books}=f;
const business=f.businesses.maker;
const inspect=()=>inspectProductionBookingBusinessHistory(pool,business);
const featureGuard=()=>tx(c=>assertDepotFeatureObligations(c,business));
async function readOnly(){const before=await snapshot(),result=await inspect();assert.deepEqual(await snapshot(),before);assert.equal(result.executionAuthority,false);return result;}
async function corruption(update,args,restore,restoreArgs){
  const before=await snapshot();await pool.query(update,args);
  try{assert((await inspect()).issues.length>0);await assert.rejects(featureGuard(),/production_booking_history_changed/);}
  finally{await pool.query(restore,restoreArgs);}
  assert.deepEqual(await snapshot(),before);
}
try{
  assert.deepEqual((await readOnly()).issues,[]);
  const offered=await invoke('offer','maker',terms(),'history-offer');
  let history=await readOnly();assert.deepEqual(history.issues,[]);assert.deepEqual(history.activeRuns,[]);await featureGuard();
  const accepted=await invoke('accept','customer',accept(offered),'history-accept');
  history=await readOnly();assert.deepEqual(history.issues,[]);assert.deepEqual(history.activeRuns,[offered.offer.bookingId]);await assert.rejects(featureGuard(),/production_booking_obligation/);
  const offer=(await pool.query('SELECT * FROM production_booking_offers WHERE id=$1',[offered.offer.bookingId])).rows[0];
  const run=(await pool.query('SELECT * FROM production_booking_runs WHERE id=$1',[offer.id])).rows[0];
  await corruption('UPDATE production_booking_offers SET source_hash=$2 WHERE id=$1',[offer.id,'0'.repeat(64)],'UPDATE production_booking_offers SET source_hash=$2 WHERE id=$1',[offer.id,offer.source_hash]);
  const ack=(await pool.query('SELECT request_hash FROM production_booking_requests WHERE account_id=$1 AND request_key=$2',['customer','history-accept'])).rows[0];
  await corruption('UPDATE production_booking_requests SET request_hash=$3 WHERE account_id=$1 AND request_key=$2',['customer','history-accept','0'.repeat(64)],'UPDATE production_booking_requests SET request_hash=$3 WHERE account_id=$1 AND request_key=$2',['customer','history-accept',ack.request_hash]);
  await corruption("UPDATE production_booking_positions SET original_account='other' WHERE booking_id=$1 AND role='maker'",[offer.id],"UPDATE production_booking_positions SET original_account='maker' WHERE booking_id=$1 AND role='maker'",[offer.id]);
  const reserve=(await pool.query('SELECT amount FROM transactions WHERE id=$1',[run.reserve_transaction])).rows[0];
  await corruption('UPDATE transactions SET amount=$2 WHERE id=$1',[run.reserve_transaction,Number(reserve.amount)-1],'UPDATE transactions SET amount=$2 WHERE id=$1',[run.reserve_transaction,reserve.amount]);
  await corruption('UPDATE commissioned_crafting_contracts SET source_hash=$2 WHERE id=$1',[run.commission_id,'0'.repeat(64)],'UPDATE commissioned_crafting_contracts SET source_hash=$2 WHERE id=$1',[run.commission_id,run.commission_source_hash]);
  await corruption('UPDATE production_slot_reservations SET source_hash=$2 WHERE id=$1',[run.reservation_id,'0'.repeat(64)],'UPDATE production_slot_reservations SET source_hash=$2 WHERE id=$1',[run.reservation_id,run.reservation_source_hash]);
  await corruption('UPDATE production_booking_runs SET business_id=$2 WHERE id=$1',[offer.id,f.businesses.other],'UPDATE production_booking_runs SET business_id=$2 WHERE id=$1',[offer.id,business]);
  const made=await invoke('complete','maker',ref(offered),'history-complete');assert.equal(made.paidBonusCash,10);
  history=await readOnly();assert.deepEqual(history.issues,[]);assert.deepEqual(history.activeRuns,[]);await featureGuard();
  const completed=(await pool.query('SELECT outcome FROM production_booking_runs WHERE id=$1',[offer.id])).rows[0];
  await corruption('UPDATE production_booking_runs SET outcome=$2 WHERE id=$1',[offer.id,JSON.stringify({...completed.outcome,sourceHash:'0'.repeat(64)})],'UPDATE production_booking_runs SET outcome=$2 WHERE id=$1',[offer.id,JSON.stringify(completed.outcome)]);
  const refundOffer=await invoke('offer','maker',terms(),'history-refund-offer');await invoke('accept','customer',accept(refundOffer),'history-refund-accept');
  await invoke('cancel','customer',ref(refundOffer),'history-refund');
  history=await readOnly();assert.deepEqual(history.issues,[]);assert.deepEqual(history.activeRuns,[]);assert.equal(history.paidBonusCash,10);assert.equal(history.refundedBonusCash,10);await featureGuard();await books();
  assert.equal((await pool.query('SELECT state FROM production_booking_runs WHERE id=$1',[refundOffer.offer.bookingId])).rows[0].state,'refunded');
  assert.equal(accepted.booking.resourcesHeld,true);
  console.log('Production booking scoped read-only offer/active/completion/refund history, original ACK/position/journal/commission/slot/outcome corruption and business feature obligations PASS. Full paid F15 and native F16 transfer positives remain separate.');
}finally{await pool.end();}
