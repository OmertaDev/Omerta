import assert from 'node:assert/strict';
import { fixture } from './merchantloyalty-fixture.js';
import { runEstate } from '../src/social/estate.js';
const f=await fixture();try{
  const prior=[await f.ordinary(),await f.ordinary()],p=await f.act('owner','create',f.programTerms,'estate-program'),next=await f.listing(),q=await f.act('buyer','quote',f.quoteBody(p,next,prior),'estate-quote'),paid=await f.act('buyer','buy',f.buyBody(q),'estate-paid'),spare=await f.listing();
  await f.G.withTwoCharacters(f.pool,'other','owner-actor',async(_actor,victim,c,h)=>runEstate(c,h,victim,'genuine loyalty estate fixture'),{meet:false});
  assert.equal((await f.pool.query("SELECT alive FROM characters WHERE id='owner-actor'")).rows[0].alive,false);assert.equal((await f.C.consignmentEconomySaleWitness(f.pool,next.offer.consignmentId)).sellerPaid,81);
  assert.deepEqual(await f.act('owner','create',f.programTerms,'estate-program'),p);assert.deepEqual(await f.act('buyer','buy',f.buyBody(q),'estate-paid'),paid);
  const heirs=(await f.pool.query("SELECT id FROM characters WHERE account_id='owner' AND alive=true")).rows;if(!heirs.length)await f.pool.query("INSERT INTO characters(id,account_id,name,season,loc,cash) VALUES('owner-heir','owner','Loyalty heir',1,'foundry',500)");
  const before=await f.state();await assert.rejects(f.act('owner','close',{programId:p.programId,programSourceHash:p.programSourceHash,consent:true},'heir-close'),/seller/);assert.deepEqual(await f.state(),before);
  const newP=await f.act('owner','create',f.programTerms,'heir-own-program');assert.notEqual(newP.programId,p.programId);
  assert.deepEqual((await f.pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',[spare.itemId])).rows[0],{owner_scope:'account',owner_id:'owner',state:'active'});
  const offer=await f.tx(c=>f.C.createConsignment(c,'owner',{itemId:spare.itemId,hostAccountId:'host',price:101,hostFeeBps:1000,lifetimeSeconds:86400,consent:true},'heir-new-original-sale')),body={consignmentId:offer.consignmentId,sourceHash:offer.sourceHash,consent:true};await f.tx(c=>f.C.acceptConsignment(c,'host',body,'heir-new-host'));
  const beforeQuote=await f.state();await assert.rejects(f.act('buyer','quote',f.quoteBody(newP,{offer},prior),'heir-old-repeat'),/prior_purchase/);assert.deepEqual(await f.state(),beforeQuote);
  assert.deepEqual(await f.L.collectMerchantLoyaltyIssues(f.pool),[]);
  console.log('Merchant loyalty '+(f.native?'native18.4':'memory')+' genuine G sorted-original runEstate PASS: old cash follows canonical estate, completed discount history/ACKs survive, no new counterpart roots/escrow/balances, heir cannot close old merchant program or borrow old-original repeat receipts; new heir-owned program works. Native full-world rollback qualification remains separate.');
}finally{await f.pool.end();}
