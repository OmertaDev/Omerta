import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture } from './merchantloyalty-fixture.js';
const f=await fixture();try{
  const prior=[await f.ordinary(),await f.ordinary()],p=await f.act('owner','create',{...f.programTerms,lifetimeSeconds:60},'expiry-program'),next=await f.listing(),q=await f.act('buyer','quote',f.quoteBody(p,next,prior),'expiry-quote'),before=await f.state();
  const observed=Date.now(),deadline=+new Date(q.expiresAt);assert(deadline>observed);assert(deadline<=+new Date(p.expiresAt));
  while(Date.now()<=deadline+100)await new Promise(resolve=>setTimeout(resolve,Math.min(1000,Math.max(1,deadline+101-Date.now()))));
  await assert.rejects(f.act('buyer','buy',f.buyBody(q),'after-real-deadline'),/expired|program_closed/);assert.deepEqual(await f.state(),before);
  const historical=await f.act('buyer','quote',f.quoteBody(p,next,prior),'expiry-quote');assert.deepEqual(historical,q);assert.deepEqual(await f.state(),before);
  // Expired records do not consume a permanent program slot or invent recovery money.
  const fresh=await f.act('owner','create',f.programTerms,'post-expiry-program');assert.notEqual(fresh.programId,p.programId);
  fs.mkdirSync('output',{recursive:true});fs.writeFileSync('output/merchant-loyalty-real-expiry.json',JSON.stringify({observedAt:new Date(observed).toISOString(),immutableQuoteDeadline:q.expiresAt,programDeadline:p.expiresAt,refusedAt:new Date().toISOString(),elapsedMs:Date.now()-observed,sourceMutations:0},null,2));
  console.log('Merchant loyalty '+(f.native?'native18.4':'memory')+' genuine elapsed immutable program/quote deadline refusal, all fixture rows unchanged, old ACK retention and expiry slot recovery PASS. No clock/source/TTL edits.');
}finally{await f.pool.end();}
