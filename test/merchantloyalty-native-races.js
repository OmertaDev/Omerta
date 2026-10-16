import assert from 'node:assert/strict';
import { nativeFixture } from "./merchantloyalty-current-native-fixture.js";
import { runEstate } from '../src/social/estate.js';
const f = await nativeFixture(), traces = [], results = [];
const buy = (p,key)=>f.tx(async c=>{
  const query=c.query,locks=[];traces.push({key,buyer:p.buyer,locks});
  c.query=function(...args){if(/^SELECT \* FROM characters WHERE id=\$1 FOR UPDATE$/.test(args[0]||''))locks.push(args[1][0]);return query.apply(this,args);};
  try{return await f.L.merchantLoyaltyAction(c,p.buyer,'buy',f.buyBody(p.quote),key);}finally{c.query=query;}
});
const refusals = values=>values.filter(r=>r.status==='rejected').map(r=>{
  assert.equal(r.reason.code,'merchant_loyalty','Transport/deadlock/test errors cannot count as canonical race refusal');
  assert(['original_actor','program_closed','already_used','quote_source','purchase_scope'].includes(r.reason.message),r.reason.message);return r.reason.message;
});
const state = async p=>(await f.pool.query('SELECT status,used_count FROM merchant_loyalty_programs WHERE id=$1',[p.program.programId])).rows[0];
try {
  {
    const p=await f.prepare(),paid=await Promise.all([buy(p,'native-same-key'),buy(p,'native-same-key')]);
    assert.deepEqual(paid[0],paid[1]);assert.equal(Number((await state(p)).used_count),1);await f.close(p.program);await f.books();results.push({race:'same key',sales:1,identicalACKs:2});
  }
  {
    const p=await f.prepare(),values=await Promise.allSettled([buy(p,'native-different-a'),buy(p,'native-different-b')]);
    assert.equal(values.filter(v=>v.status==='fulfilled').length,1);assert.equal(Number((await state(p)).used_count),1);await f.close(p.program);await f.books();results.push({race:'different keys',sales:1,refusals:refusals(values)});
  }
  {
    const p=await f.prepare(),values=await Promise.allSettled([buy(p,'native-buy-v-close'),f.close(p.program)]);
    assert.equal(values[1].status,'fulfilled',values[1].reason?.message);const committed=values[0].status==='fulfilled',row=await state(p);
    assert.equal(row.status,'closed');assert.equal(Number(row.used_count),committed?1:0);
    assert.equal((await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1',[p.listing.itemId])).rows[0].owner_id,committed?'buyer':p.listing.offer.consignmentId);
    await f.books();results.push({race:'buy versus original merchant close',committedSale:committed,refusals:refusals(values)});
  }
  {
    const p=await f.prepare({terms:{maximumUses:1}}),other=await f.prepare({buyer:'other',program:p.program});
    const values=await Promise.allSettled([buy(p,'native-cap-buyer'),buy(other,'native-cap-other')]);
    assert.equal(values.filter(v=>v.status==='fulfilled').length,1);assert.equal(Number((await state(p)).used_count),1);
    const consumed=(await f.pool.query("SELECT id FROM merchant_loyalty_quotes WHERE program_id=$1 AND status='consumed'",[p.program.programId])).rows;assert.equal(consumed.length,1);
    await f.close(p.program);await f.books();results.push({race:'two genuine customers last use',sales:1,refusals:refusals(values)});
  }
  {
    const p=await f.prepare(),values=await Promise.allSettled([buy(p,'native-buy-v-estate'),f.G.withTwoCharacters(f.pool,'buyer','owner-actor',(_actor,victim,c,h)=>runEstate(c,h,victim,'N17 actual merchant estate race'),{meet:false})]);
    assert.equal(values[1].status,'fulfilled',values[1].reason?.message);const committed=values[0].status==='fulfilled';assert.equal(Number((await state(p)).used_count),committed?1:0);
    assert.equal((await f.pool.query("SELECT alive FROM characters WHERE id='owner-actor'")).rows[0].alive,false);
    assert.equal((await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1',[p.listing.itemId])).rows[0].owner_id,committed?'buyer':'owner');
    await f.books();results.push({race:'buy versus genuine original merchant estate',committedSale:committed,refusals:refusals(values)});
  }
  for(const trace of traces)if(trace.locks.length){const expected=[trace.buyer+'-actor','host-actor','owner-actor'].sort();assert.deepEqual(trace.locks.slice(0,3),expected);assert(trace.locks.every(id=>expected.includes(id)));}
  assert(traces.some(t=>t.locks.length>=3));
  console.log(JSON.stringify({proof:'N17 actual original-three-root concurrent requests, replay/cap/close/estate outcomes; no forced common-preflight claim',results,traces,checks:await f.books()}));
} finally { await f.pool.end(); }
