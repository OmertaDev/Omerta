import assert from 'node:assert/strict';import {fixture} from './productionbooking-fixture.js';
const f=await fixture(),{pool,tx,B,invoke,terms,ref,accept,snapshot,books}=f;let n=0;
const funded=async()=>{const q=await invoke('offer','maker',terms(),'recovery-offer-'+(++n));const b=await invoke('accept','customer',accept(q),'recovery-accept-'+n);return{q,b};};
try{
  // A source changed after one original's offer must never reserve the other
  // original's money, materials or gameplay capacity.
  const pending=await invoke('offer','maker',terms(),'pending-original');await f.A.setAgentCompany(pool,'maker',{expectedRevision:1,name:'Benign rename',published:true,premises:'estate'});
  // N13's actual premises identity ignores a harmless company name/revision.
  const b=await invoke('accept','customer',accept(pending),'benign-profile-accept');
  const balance=Number((await pool.query("SELECT cash FROM characters WHERE id='customer-actor'")).rows[0].cash);
  const baseRef={commissionId:b.booking.commissionId,sourceHash:(await pool.query('SELECT commission_source_hash FROM production_booking_runs WHERE id=$1',[b.booking.bookingId])).rows[0].commission_source_hash,consent:true};
  const ordinary=await tx(c=>f.C.refundCommission(c,'maker',baseRef,'ordinary-canonical-refund'));assert.equal(ordinary.refundedFee,100);assert(!Object.hasOwn(ordinary,'refundedBonusCash'),'Preserve existing canonical fee receipt exactly');
  assert.equal(Number((await pool.query("SELECT cash FROM characters WHERE id='customer-actor'")).rows[0].cash),balance+110);assert.equal((await B.productionBookingBoard(pool,'maker')).bookings[0].state,'refunded');await books();
  const release=await funded(),run=(await pool.query('SELECT * FROM production_booking_runs WHERE id=$1',[release.q.offer.bookingId])).rows[0];
  const ended=await tx(c=>f.R.productionSlotAction(c,'customer','release',{reservationId:run.reservation_id,sourceHash:run.reservation_source_hash,consent:true},'ordinary-n09-release'));
  assert.equal(ended.status,'void');assert.equal((await pool.query('SELECT state FROM production_booking_runs WHERE id=$1',[run.id])).rows[0].state,'refunded');await books();
  const expires=await funded(),before=await snapshot();await assert.rejects(invoke('expire','customer',ref(expires.q)),/deadline/);assert.deepEqual(await snapshot(),before);
  const query=pool.query.bind(pool),deadline=Date.parse(expires.b.booking.deadline);
  await tx(async c=>{const raw=c.query;c.query=async function(sql,values){if(sql==='SELECT clock_timestamp() AS at')return{rows:[{at:new Date(deadline+1)}]};return raw.call(this,sql,values);};try{await B.expireProductionBooking(c,'maker',ref(expires.q),'actual-expiry');}finally{c.query=raw;}});
  assert.equal((await pool.query('SELECT state FROM production_booking_runs WHERE id=$1',[expires.q.offer.bookingId])).rows[0].state,'refunded');await books();
  const changed=await invoke('offer','maker',terms(),'stale-source');await f.configure('maker',[f.bench(f.tool),f.service(2)],1,'real-floor-revision');const stale=await snapshot();
  await assert.rejects(invoke('accept','customer',accept(changed)),/source_changed/);assert.deepEqual(await snapshot(),stale);await invoke('cancel','maker',ref(changed));
  // Recovery and original immutable acknowledgement do not rely on today's
  // profile/floor source, and cannot become fresh execution authority.
  assert.equal((await invoke('offer','maker',terms(),'pending-original')).offer.bookingId,pending.offer.bookingId);
  const count=await books();console.log('Production booking ordinary N03 refund/N09 release, exact fee+bonus recovery, expiry, benign rename, stale source refusal, no pending hold and immutable original ACK PASS; '+count+' global checks PASS.');
}finally{await pool.end();}
