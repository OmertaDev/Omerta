import assert from 'node:assert/strict';import {fixture} from './productionbooking-fixture.js';
const makerDeath=process.argv.includes('--maker-death'),f=await fixture(true),{app,pool,terms,accept,invoke,books}=f;let n=0;
const post=async(a,url,body)=>{const r=await app.inject({method:'POST',url,payload:body,headers:{authorization:'Bearer '+app.jwt.sign({sub:a,tv:0,agent:true}),'idempotency-key':'booking-estate-'+(++n)}});assert.equal(r.statusCode,200,r.body);return r.json();};
try{
  const q=await invoke('offer','maker',terms()),b=await invoke('accept','customer',accept(q));
  const victim=makerDeath?'maker':'customer',killer=makerDeath?'customer':'other';
  const cash=Number((await pool.query("SELECT cash FROM characters WHERE id='customer-actor'")).rows[0].cash);
  const victimCash=Number((await pool.query('SELECT cash FROM characters WHERE id=$1',[victim+'-actor'])).rows[0].cash);
  Object.assign(process.env,{PEN_YARD_EVENT:'quiet',SHANK_P:'1'});for(const a of [victim,killer])await pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1',[a+'-actor',new Date(Date.now()+1800000)]);
  await post(killer,'/v1/pen/buy/shiv');const afterBuy=Number((await pool.query("SELECT cash FROM characters WHERE id='customer-actor'")).rows[0].cash);
  const killed=await post(killer,'/v1/pen/shank/'+victim+'-actor');assert.equal(killed.kill,true);
  const r=(await pool.query('SELECT * FROM production_booking_runs WHERE id=$1',[q.offer.bookingId])).rows[0];assert.equal(r.state,'refunded');assert.equal(Number(r.refunded_cash),10);assert.equal(Number(r.remaining_cash),0);
  assert.equal((await pool.query('SELECT status FROM commissioned_crafting_contracts WHERE id=$1',[b.booking.commissionId])).rows[0].status,'refunded');assert.equal((await pool.query('SELECT status FROM production_slot_reservations WHERE id=$1',[b.booking.reservationId])).rows[0].status,'void');
  const bonus=(await pool.query("SELECT amount,character_id FROM transactions WHERE counterparty=$1 AND reason='production_booking:bonus_refund'",[q.offer.bookingId])).rows;assert.equal(bonus.length,1);assert.equal(bonus[0].character_id,'customer-actor');assert.equal(Number(bonus[0].amount),10);
  const burn=(await pool.query("SELECT amount FROM transactions WHERE character_id=$1 AND currency='cash' AND reason='death:estate'",[victim+'-actor'])).rows;assert.equal(burn.length,1);assert.equal(Number(burn[0].amount),-(victimCash+(makerDeath?0:110)));
  if(makerDeath)assert.equal(Number((await pool.query("SELECT cash FROM characters WHERE id='customer-actor'")).rows[0].cash),afterBuy+110);
  const count=await books();console.log('Production booking genuine public Pen.shank '+victim+' estate: actual original fee+bonus delta before snapshot, no duplicate customer/killer credit, canonical terminal slot and released physical holds PASS; '+count+' global checks PASS.');
}finally{await app.close();}
