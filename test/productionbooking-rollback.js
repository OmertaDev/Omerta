import assert from 'node:assert/strict';import {fixture} from './productionbooking-fixture.js';
const f=await fixture(),{pool,tx,B,terms,ref,accept,invoke,snapshot,books}=f;
async function late(action,a,b,needle){const before=await snapshot(),audit=await f.audit();let reached=false,events=0;await assert.rejects(tx(async c=>{const raw=c.query;c.query=async function(sql,values){const result=await raw.call(this,sql,values);if(sql.includes('INSERT INTO item_events'))events++;if(!reached&&sql.startsWith(needle)){reached=true;throw Error('actual late '+action+' boundary');}return result;};try{await B[action+'ProductionBooking'](c,a,b,'late-'+action);}finally{c.query=raw;}}),new RegExp('actual late '+action));assert(reached);assert.deepEqual(await snapshot(),before);f.compareAudit(audit,await f.audit(),events);}
try{
  const q=await invoke('offer','maker',terms());await late('accept','customer',accept(q),'INSERT INTO production_booking_positions');const b=await invoke('accept','customer',accept(q));
  await late('complete','maker',ref(q),'UPDATE production_booking_positions SET state=');
  await late('cancel','customer',ref(q),'UPDATE production_booking_positions SET state=');
  const before=await snapshot();await assert.rejects(tx(async c=>{try{await B.retireProductionBookingForCommission(c,b.booking.commissionId,{},{});}catch{}return'caught forged refund must poison';}),/refund_scope/);assert.deepEqual(await snapshot(),before);
  await invoke('cancel','customer',ref(q));const count=await books();console.log('Production booking actual post-canonical acceptance/UID-handover+fee+bonus/canonical fee+bonus refund rollback, exact snapshot and caught-token poison PASS; '+count+' global checks PASS.');
}finally{await pool.end();}
