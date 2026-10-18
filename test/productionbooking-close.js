import assert from 'node:assert/strict';import {fixture} from './productionbooking-fixture.js';
const f=await fixture(),{pool,G,D,terms,ref,accept,invoke,snapshot,books}=f;
const close=(account,business,beforeCharacterLock=null)=>G.withCharacter(pool,account,(ch,c,h)=>D.closeDepot(ch,business,c,h),{meet:false,beforeCharacterLock});
try{
  const q=await invoke('offer','maker',terms());
  // Pending proposals have no physical or financial hold, including on an
  // unrelated original's business. The actual business guard is selective.
  await close('other',f.businesses.other);assert.equal((await pool.query('SELECT status FROM business_depots WHERE id=$1',[f.businesses.other])).rows[0].status,'closed');
  const b=await invoke('accept','customer',accept(q)),beforeSettlement=await snapshot();
  // The clock settles in its own committed phase before a refused action.
  // Observe the complete action baseline on its client, after that settlement.
  const clockStarted=Date.now();await new Promise(resolve=>setTimeout(resolve,1100));assert(Date.now()-clockStarted>=1000,'Real clock must advance through settlement threshold');
  let before=null;
  await assert.rejects(close('maker',f.businesses.maker,async client=>{before=await snapshot(client);}),e=>e.code==='production_booking'&&e.message==='workshop_reserved');
  assert(before,'Action baseline hook must run');
  const priorMaker=beforeSettlement.characters.find(ch=>ch.account_id==='maker'),settledMaker=before.characters.find(ch=>ch.account_id==='maker');
  assert(new Date(settledMaker.last_accrued_at)-new Date(priorMaker.last_accrued_at)>=1000,'Phase-one clock settlement must remain committed after refusal');
  assert(Number(settledMaker.energy)>Number(priorMaker.energy));assert(Number(settledMaker.nerve)>Number(priorMaker.nerve));
  assert(Number(settledMaker.bank_credit_ms)<Number(priorMaker.bank_credit_ms));assert(Number(settledMaker.racket_credit_ms)<Number(priorMaker.racket_credit_ms));
  assert.deepEqual(await snapshot(),before);
  const pendingTx=(await pool.query('SELECT * FROM production_booking_runs WHERE id=$1',[q.offer.bookingId])).rows[0];assert.equal(pendingTx.state,'active');
  await invoke('cancel','customer',ref(q));await close('maker',f.businesses.maker);
  assert.equal((await pool.query('SELECT status FROM business_depots WHERE id=$1',[f.businesses.maker])).rows[0].status,'closed');
  const r=(await pool.query('SELECT * FROM production_booking_runs WHERE id=$1',[q.offer.bookingId])).rows[0];assert.equal(r.state,'refunded');assert.equal(Number(r.remaining_cash),0);assert.equal(Number(r.refunded_cash),10);
  assert.equal((await pool.query('SELECT status FROM production_slot_reservations WHERE id=$1',[b.booking.reservationId])).rows[0].status,'void');
  assert.equal((await pool.query("SELECT original_character FROM production_booking_positions WHERE booking_id=$1 AND state='held'",[r.id])).rows.length,0);
  assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',[f.tool])).rows[0],{owner_scope:'account',owner_id:'maker',state:'active'});
  const count=await books();console.log('Production booking selective canonical closeDepot refusal, pending/unrelated business freedom, genuine original refund releases bonus/exact UID/slot/both positions and permits ordinary close PASS; '+count+' global checks PASS.');
}finally{await pool.end();}
