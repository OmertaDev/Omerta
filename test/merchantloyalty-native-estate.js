import assert from 'node:assert/strict';
import { nativeFixture, observeItemAllocations, assertExactRollback } from './merchantloyalty-native-fixture.js';
import { runEstate } from '../src/social/estate.js';
const f=await nativeFixture();
try {
  const p=await f.prepare(),paid=await f.act('buyer','buy',f.buyBody(p.quote),'native-estate-paid'),spare=await f.listing();
  const right=await f.tx(c=>f.M.merchantReturnAction(c,'owner','offer',{consignmentId:paid.sale.consignmentId,sourceHash:paid.sale.sourceHash,refundCash:81,lifetimeSeconds:60,consent:true},'native-estate-own-reserve',{assertLifecycle:x=>f.I.assertItemTransaction(x)}));
  const events=[];let before;
  await assert.rejects(f.G.withTwoCharacters(f.pool,'buyer','owner-actor',(_actor,victim,c,h)=>observeItemAllocations(c,events,async()=>{
    await runEstate(c,h,victim,'N17 genuine late estate rollback');throw Error('N17 after runEstate before G persistence');
  }),{meet:false,withActionScope:async(_c,_a,execute)=>{before=await f.snapshot();return execute();}}),/N17 after runEstate before G persistence/);
  assert(before);assert(events.some(e=>e.item_id===spare.itemId&&e.event_kind==='released'));assertExactRollback(before,await f.snapshot(),events);await f.books();
  let merchantBefore,peers,successorId,originalGeneration;
  await f.G.withTwoCharacters(f.pool,'buyer','owner-actor',async(_actor,victim,c,h)=>{
    merchantBefore=Number(victim.cash)+Number(victim.bank);originalGeneration=Number(victim.generation);peers=(await c.query("SELECT id,cash FROM characters WHERE id IN ('buyer-actor','host-actor','other-actor') ORDER BY id")).rows;
    const estate=await runEstate(c,h,victim,'N17 genuine merchant estate with original N10 reserve');successorId=estate.heirId;return estate;
  },{meet:false});
  const recovery=(await f.pool.query('SELECT state,escrow_cash,paid_cash,refunded_cash FROM merchant_return_rights WHERE id=$1',[right.returnId])).rows[0];
  assert.equal(recovery.state,'party_dead');assert.equal(Number(recovery.escrow_cash),0);assert.equal(Number(recovery.paid_cash),0);assert.equal(Number(recovery.refunded_cash),81);
  const refund=(await f.pool.query("SELECT character_id,currency,amount FROM transactions WHERE counterparty=$1 AND reason='merchant_return:refund'",[right.returnId])).rows;
  assert.deepEqual(refund.map(r=>[r.character_id,r.currency,Number(r.amount)]),[['owner-actor','cash',81]]);
  const death=(await f.pool.query("SELECT amount FROM transactions WHERE character_id='owner-actor' AND currency='cash' AND reason='death:estate'")).rows;
  assert.equal(death.length,1);assert.equal(Number(death[0].amount),-(merchantBefore+81));
  assert.deepEqual((await f.pool.query("SELECT id,cash FROM characters WHERE id IN ('buyer-actor','host-actor','other-actor') ORDER BY id")).rows,peers);
  assert.equal((await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1',[spare.itemId])).rows[0].owner_id,'owner');
  assert.equal((await f.C.consignmentEconomySaleWitness(f.pool,paid.sale.consignmentId)).sellerPaid,81);
  assert.equal((await f.pool.query("SELECT alive FROM characters WHERE id='owner-actor'")).rows[0].alive,false);
  const successors=(await f.pool.query("SELECT id,account_id,alive,generation FROM characters WHERE account_id='owner' AND alive=true ORDER BY id")).rows;
  assert.equal(successors.length,1);assert.equal(successors[0].id,successorId);assert.notEqual(successorId,'owner-actor');assert.equal(successors[0].account_id,'owner');assert.equal(Number(successors[0].generation),originalGeneration+1);
  const stable=await f.snapshot();assert.deepEqual(await f.act('buyer','buy',f.buyBody(p.quote),'native-estate-paid'),paid);assertExactRollback(stable,await f.snapshot(),[]);
  await assert.rejects(f.act('owner','close',{programId:p.program.programId,programSourceHash:p.program.programSourceHash,consent:true},'native-dead-original-close'),error=>error.code==='merchant_loyalty'&&error.message==='seller');assertExactRollback(stable,await f.snapshot(),[]);
  console.log(JSON.stringify({proof:'N17 genuine G estate callback late rollback, only original N10 reserve81 refund before exact cash estate, immutable discounted history/ACK, actual successor seller refusal and no peer cash',events,merchantBefore,successorId,checks:await f.books()}));
} finally { await f.pool.end(); }
