import assert from 'node:assert/strict';import {fixture} from './productionbooking-fixture.js';
const f=await fixture(),{pool,G,D,terms,ref,accept,invoke,snapshot,books}=f;
const close=(account,business)=>G.withCharacter(pool,account,(ch,c,h)=>D.closeDepot(ch,business,c,h),{meet:false});
try{
  const q=await invoke('offer','maker',terms());
  // Pending proposals have no physical or financial hold, including on an
  // unrelated original's business. The actual business guard is selective.
  await close('other',f.businesses.other);assert.equal((await pool.query('SELECT status FROM business_depots WHERE id=$1',[f.businesses.other])).rows[0].status,'closed');
  const b=await invoke('accept','customer',accept(q)),before=await snapshot();
  await assert.rejects(close('maker',f.businesses.maker),e=>e.code==='production_booking'&&e.message==='workshop_reserved');assert.deepEqual(await snapshot(),before);
  const pendingTx=(await pool.query('SELECT * FROM production_booking_runs WHERE id=$1',[q.offer.bookingId])).rows[0];assert.equal(pendingTx.state,'active');
  await invoke('cancel','customer',ref(q));await close('maker',f.businesses.maker);
  assert.equal((await pool.query('SELECT status FROM business_depots WHERE id=$1',[f.businesses.maker])).rows[0].status,'closed');
  const r=(await pool.query('SELECT * FROM production_booking_runs WHERE id=$1',[q.offer.bookingId])).rows[0];assert.equal(r.state,'refunded');assert.equal(Number(r.remaining_cash),0);assert.equal(Number(r.refunded_cash),10);
  assert.equal((await pool.query('SELECT status FROM production_slot_reservations WHERE id=$1',[b.booking.reservationId])).rows[0].status,'void');
  assert.equal((await pool.query("SELECT original_character FROM production_booking_positions WHERE booking_id=$1 AND state='held'",[r.id])).rows.length,0);
  assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',[f.tool])).rows[0],{owner_scope:'account',owner_id:'maker',state:'active'});
  const count=await books();console.log('Production booking selective canonical closeDepot refusal, pending/unrelated business freedom, genuine original refund releases bonus/exact UID/slot/both positions and permits ordinary close PASS; '+count+' global checks PASS.');
}finally{await pool.end();}
