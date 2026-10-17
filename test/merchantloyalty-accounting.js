import assert from 'node:assert/strict';
import { fixture } from './merchantloyalty-fixture.js';
const f=await fixture();try{
  const prior=[await f.ordinary(),await f.ordinary()],cases=[
    [1,2000,2000,100000],[9,1,2000,50],[10,1000,0,1],[11,1000,909,50],
    [101,1000,1000,50],[101,2000,2000,1],[999,1999,2000,100000],[1000,2000,2000,100000],
    [1001,1,0,50],[4999,2000,1999,50],[9999,1,2000,100000],[10000,1,2000,100000],
    [10001,2000,1,100000],[1000000,2000,2000,100000],
  ];
  // A funded fixture may afford ordinary small cases; the final intentionally unaffordable case
  // verifies no partial seller/host credit, item movement, quote consumption or new money.
  for(const [n,[price,bps,feeBps,cap]]of cases.entries()){
    const p=await f.act('owner','create',{...f.programTerms,discountBps:bps,maximumDiscountCash:cap,maximumUses:1},'rounding-program-'+n),next=await f.listing({price,hostFeeBps:feeBps}),discount=Math.min(Math.floor(price*bps/10000),cap),hostFee=Math.floor(price*feeBps/10000),beforeQuote=await f.state();
    if(discount===0){await assert.rejects(f.act('buyer','quote',f.quoteBody(p,next,prior),'zero-discount-'+n),/no_discount/);assert.deepEqual(await f.state(),beforeQuote);}else{
      const q=await f.act('buyer','quote',f.quoteBody(p,next,prior),'rounding-quote-'+n),before=await f.state();assert.equal(q.buyerPaid,price-discount);assert.equal(q.hostFee,hostFee);assert.equal(q.sellerPaid,price-discount-hostFee);
      if(q.buyerPaid>Number(before.characters.find(c=>c.id==='buyer-actor').cash)){await assert.rejects(f.act('buyer','buy',f.buyBody(q),'unfunded-'+n),/cash/);assert.deepEqual(await f.state(),before);}else{
        const paid=await f.act('buyer','buy',f.buyBody(q),'rounding-buy-'+n),legs=(await f.pool.query("SELECT reason,amount FROM transactions WHERE counterparty=$1 ORDER BY reason",[next.offer.consignmentId])).rows;assert.equal(legs.length,3);assert.equal(legs.reduce((sum,l)=>sum+Number(l.amount),0),0);assert.deepEqual(legs.map(l=>Number(l.amount)),[hostFee,q.sellerPaid,-q.buyerPaid]);assert.equal(paid.sale.paid,q.buyerPaid);
        const after=await f.state();assert.equal(after.characters.reduce((sum,c)=>sum+Number(c.cash),0),before.characters.reduce((sum,c)=>sum+Number(c.cash),0));const blocked=await f.listing();await assert.rejects(f.act('buyer','quote',f.quoteBody(p,blocked,prior),'one-buyer-'+n),/program_closed|already_used/);await f.tx(c=>f.C.cancelConsignment(c,'owner',blocked.body,'rounding-blocked-'+n));
      }
    }
    await f.act('owner','close',{programId:p.programId,programSourceHash:p.programSourceHash,consent:true},'rounding-close-'+n);
    const row=(await f.pool.query('SELECT status FROM consignments WHERE id=$1',[next.offer.consignmentId])).rows[0];if(row.status==='active')await f.tx(c=>f.C.cancelConsignment(c,'owner',next.body,'rounding-unsold-'+n));
    assert.deepEqual(await f.L.collectMerchantLoyaltyIssues(f.pool),[]);assert.deepEqual(await f.C.collectConsignmentIssues(f.pool),[]);
  }
  console.log('Merchant loyalty '+(f.native?'native18.4':'memory')+' '+cases.length+' deterministic actual gameplay accounting/rounding/cap/zero-fee/zero-discount/unaffordable/one-buyer-use cases PASS; all discounts funded solely by foregone seller proceeds,3 actual journals conserve cash, no credit/points balance.');
}finally{await f.pool.end();}
