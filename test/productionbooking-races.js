import assert from 'node:assert/strict';import {fixture} from './productionbooking-fixture.js';
const mode=process.argv.find(x=>x.startsWith('--race='))?.slice(7)||'accept',f=await fixture(),{pool,tx,invoke,terms,accept,ref,books}=f;
try{
  const q=await invoke('offer','maker',terms());let results;
  if(mode==='accept'){
    results=await Promise.allSettled([invoke('accept','customer',accept(q),'race-accept-a'),invoke('accept','customer',accept(q),'race-accept-b')]);
    assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
    const r=(await pool.query('SELECT * FROM production_booking_runs WHERE id=$1',[q.offer.bookingId])).rows[0];assert.equal(r.state,'active');
    assert.deepEqual(await tx(c=>f.C.commissionedCraftingDeathCounterparts(c,'customer-actor')),['customer-actor','maker-actor']);
    assert.equal((await pool.query("SELECT id FROM commissioned_crafting_contracts WHERE status='accepted'")).rows.length,1);
    await invoke('cancel','customer',ref(q));
  }else if(mode==='completion'){
    await invoke('accept','customer',accept(q));results=await Promise.allSettled([invoke('complete','maker',ref(q),'race-real-completion'),invoke('cancel','customer',ref(q),'race-real-refund')]);
    assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
    const r=(await pool.query('SELECT * FROM production_booking_runs WHERE id=$1',[q.offer.bookingId])).rows[0];assert(['completed','refunded'].includes(r.state));
    assert.equal(Number(r.paid_cash)+Number(r.refunded_cash),10);assert.equal(Number(r.remaining_cash),0);
  }else if(mode==='custody'){
    const X=await import('../src/consignments.js'),sale=await tx(c=>X.createConsignment(c,'maker',{itemId:f.tool,hostAccountId:'other',price:101,hostFeeBps:1000,lifetimeSeconds:86400,consent:true},'race-sale-offer'));
    const saleRef={consignmentId:sale.consignmentId,sourceHash:sale.sourceHash,consent:true};
    results=await Promise.allSettled([invoke('accept','customer',accept(q),'race-booking-custody'),tx(c=>X.acceptConsignment(c,'other',saleRef,'race-host-custody'))]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
    const r=(await pool.query('SELECT * FROM production_booking_runs WHERE id=$1',[q.offer.bookingId])).rows[0],item=(await pool.query('SELECT owner_scope,owner_id FROM item_instances WHERE id=$1',[f.tool])).rows[0];
    if(r){assert.equal(r.state,'active');assert.deepEqual(item,{owner_scope:'account',owner_id:'maker'});await invoke('cancel','customer',ref(q));}
    else {assert.equal(item.owner_scope,'operation');await tx(c=>X.cancelConsignment(c,'maker',saleRef,'race-sale-return'));await invoke('cancel','maker',ref(q));}
  }else throw Error('Unknown bounded race');
  const count=await books();console.log('Production booking '+(f.native?'native PostgreSQL':'serialized memory')+' '+mode+' contention: one genuine committed winner, conserved original cash/items, closed accepted pair and no duplicate bonus PASS; '+count+' global checks PASS.');
}finally{await pool.end();}
