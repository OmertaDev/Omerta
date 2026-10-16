import assert from 'node:assert/strict';
import { nativeFixture, observeItemAllocations, assertExactRollback } from './merchantloyalty-native-fixture.js';
const f=await nativeFixture();
try {
  const p=await f.prepare({terms:{lifetimeSeconds:60}}),before=await f.snapshot(),events=[],reads=[];let reached=0;
  const start=Date.now(),deadline=+new Date(p.quote.expiresAt);assert(deadline>Date.now());
  await assert.rejects(f.tx(c=>observeItemAllocations(c,events,()=>f.L.merchantLoyaltyAction(c,'buyer','buy',f.buyBody(p.quote),'native-real-post-source-expiry'),async(sql,result,args)=>{
    if(!/UPDATE consignment_requests SET receipt=/.test(sql||''))return;
    assert.equal(result.rowCount,1);assert.equal(++reached,1);
    assert((await c.query('SELECT receipt FROM consignment_requests WHERE account_id=$1 AND key_hash=$2',args[1].slice(0,2))).rows[0]?.receipt);
    // Keep the genuine transaction alive with read-only queries. No timeout,
    // deadline, clock, source row or other server configuration is changed.
    const timeout=Date.now()+75000;
    while(true){const observed=(await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed,at=+new Date(observed);reads.push(new Date(at).toISOString());if(at>deadline+150)break;assert(Date.now()<timeout,'Real deadline did not progress');await new Promise(resolve=>setTimeout(resolve,Math.min(10000,Math.max(1,deadline+151-at))));}
  })),error=>{assert.equal(error.code,'merchant_loyalty');assert(['expired','purchase_scope','program_closed'].includes(error.message),error.message);return true;});
  assert.equal(reached,1);assert(reads.length>=2);assert.deepEqual(events.map(e=>e.event_kind),['released','transferred']);assert(events.every(e=>e.item_id===p.listing.itemId));
  assertExactRollback(before,await f.snapshot(),events);await f.books();
  const stable=await f.snapshot();assert.deepEqual(await f.act('buyer','quote',f.quoteBody(p.program,p.listing,p.prior),'native-quote-'+p.n),p.quote);assertExactRollback(stable,await f.snapshot(),[]);
  const fresh=await f.act('owner','create',f.programTerms,'native-after-real-expiry');assert.notEqual(fresh.programId,p.program.programId);
  console.log(JSON.stringify({proof:'N17 immutable real program/quote expiry after actual N01 receipt UPDATE, before N17 final ACK; whole-world rollback and observed allocator advances only',deadline:p.quote.expiresAt,elapsedMs:Date.now()-start,actualReadOnlyKeepalives:reads,events,checks:await f.books()}));
} finally { await f.pool.end(); }
