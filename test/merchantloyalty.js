import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture } from './merchantloyalty-fixture.js';
const f=await fixture(),{pool,tx,I,C,L,M,G,act,programTerms,state,ordinary,listing,quoteBody,buyBody}=f;
const unchanged=async(fn,pattern)=>{const before=await state();await assert.rejects(fn,pattern);assert.deepEqual(await state(),before);};
const books=async()=>{assert.deepEqual(await L.collectMerchantLoyaltyIssues(pool),[]);assert.deepEqual(await C.collectConsignmentIssues(pool),[]);};
const cash=async()=>Number((await pool.query('SELECT SUM(cash) AS n FROM characters')).rows[0].n);
try{
  assert.equal(typeof C.buyConsignmentWithEconomyContext,'function','Actual canonical shared leaf required; no test callback or fake purchase');
  const prior=[await ordinary(),await ordinary()],originalReceipts=structuredClone(prior.map(p=>p.sale));
  for(const p of prior){assert.equal(p.sale.paid,101);assert(!('loyalty'in p.sale));assert.equal((await C.consignmentEconomySaleWitness(pool,p.sale.consignmentId)).sellerPaid,91);}
  for(const [n,b]of [{...programTerms,discountBps:2001},{...programTerms,requiredPurchases:1},{...programTerms,maximumUses:21},{...programTerms,consent:false},{...programTerms,extra:true}].entries())await unchanged(()=>act('owner','create',b,'bad-program-'+n),/terms/);
  const program=await act('owner','create',programTerms,'program'),p2=await act('owner','create',programTerms,'program-2');await unchanged(()=>act('owner','create',programTerms,'program-cap'),/program_limit/);
  await act('owner','close',{programId:p2.programId,programSourceHash:p2.programSourceHash,consent:true},'close-spare');
  const next=await listing(),qb=quoteBody(program,next,prior),beforeQuote=await state(),quote=await act('buyer','quote',qb,'quote');
  assert.equal(quote.grossPrice,101);assert.equal(quote.buyerPaid,91);assert.equal(quote.hostFee,10);assert.equal(quote.sellerPaid,81);assert.equal(quote.discountCash,10);
  const afterQuote=await state();for(const table of ['characters','transactions','item_instances','item_events','operation_escrow'])assert.deepEqual(afterQuote[table],beforeQuote[table],'Quote has zero '+table+' effects');
  await unchanged(()=>act('buyer','quote',{...qb,qualifyingSaleIds:[prior[0].sale.consignmentId,prior[0].sale.consignmentId]},'same-sale'),/distinct_purchases/);
  await unchanged(()=>act('other','quote',qb,'foreign-buyer'),/prior_purchase/);
  await unchanged(()=>act('buyer','quote',{...qb,programSourceHash:'0'.repeat(64)},'source-drift'),/program_source/);
  await unchanged(()=>act('other','buy',buyBody(quote),'foreign-quote'),/listing_changed/);
  await unchanged(()=>act('buyer','buy',{...buyBody(quote),discountCash:100},'forged-discount'),/terms/);
  await unchanged(()=>tx(c=>L.assertMerchantLoyaltyPurchaseScope(c,{},next.offer.consignmentId,next.offer.sourceHash,'buyer')),/purchase_scope/);
  await unchanged(()=>tx(c=>C.buyConsignmentWithEconomyContext(c,'buyer',next.body,'direct-forgery',{loyaltyContext:{}})),/purchase_scope/);
  await unchanged(()=>tx(async c=>{try{await L.merchantLoyaltyAction(c,'buyer','buy',{...buyBody(quote),quoteSourceHash:'0'.repeat(64)},'caught');}catch{}return 'cannot commit';}),/quote_source/);
  const audit=f.native?await (await import('../tools/rc1-native-proof.js')).canonicalDatabaseSnapshot(pool):null;
  await unchanged(()=>tx(async c=>{await L.merchantLoyaltyAction(c,'buyer','buy',buyBody(quote),'late');throw Error('loyalty late failure');}),/loyalty late failure/);
  if(f.native){const restored=await (await import('../tools/rc1-native-proof.js')).canonicalDatabaseSnapshot(pool);assert.deepEqual(restored.tables,audit.tables);assert.deepEqual(restored.sequences,audit.sequences.map(s=>s.sequencename==='item_events_sequence_seq'?{...s,last_value:String(BigInt(s.last_value)+2n)}:s));}
  const total=await cash(),paid=await act('buyer','buy',buyBody(quote),'discounted');assert.equal(paid.sale.paid,91);assert.equal(paid.sale.hostFee,10);assert.equal(await cash(),total);
  assert.deepEqual((await pool.query("SELECT reason,amount FROM transactions WHERE counterparty=$1 ORDER BY reason",[next.offer.consignmentId])).rows.map(l=>[l.reason,Number(l.amount)]),[['consignment:host_fee',10],['consignment:proceeds',81],['consignment:purchase',-91]]);
  assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',[next.itemId])).rows[0],{owner_scope:'account',owner_id:'buyer',state:'active'});
  assert.deepEqual(paid.sale.loyalty,{programId:program.programId,programSourceHash:program.programSourceHash,quoteId:quote.quoteId,quoteSourceHash:quote.quoteSourceHash,discountCash:10});
  const done=await state();assert.deepEqual(await act('buyer','buy',buyBody(quote),'discounted'),paid);assert.deepEqual(await state(),done);await unchanged(()=>act('buyer','buy',{...buyBody(quote),quoteSourceHash:'0'.repeat(64)},'discounted'),/request_conflict/);await unchanged(()=>act('buyer','buy',buyBody(quote),'second-buy'),/original_actor|quote_source/);
  await books();
  // N10 shares the same validated historical sale and may promise only the actual seller net.
  const offerBody={consignmentId:paid.sale.consignmentId,sourceHash:paid.sale.sourceHash,refundCash:82,lifetimeSeconds:60,consent:true},lifecycle=c=>I.assertItemTransaction(c);
  await unchanged(()=>tx(c=>M.merchantReturnAction(c,'owner','offer',offerBody,'over-net',{assertLifecycle:lifecycle})),/seller/);
  const right=await tx(c=>M.merchantReturnAction(c,'owner','offer',{...offerBody,refundCash:81},'true-net',{assertLifecycle:lifecycle})),rr={returnId:right.returnId,sourceHash:right.sourceHash,consent:true};
  await tx(c=>M.merchantReturnAction(c,'buyer','accept',rr,'return-consent',{assertLifecycle:lifecycle}));const returned=await tx(c=>M.merchantReturnAction(c,'buyer','return',rr,'actual-return',{assertLifecycle:lifecycle}));assert.equal(returned.paidCash,81);assert.equal((await C.consignmentEconomySaleWitness(pool,next.offer.consignmentId)).buyerPaid,91);await books();
  // Earned history survives later legitimate transfers; it cannot qualify a new purchase after wash.
  await tx(c=>I.transferItem(c,{scope:'account',id:'buyer'},{scope:'account',id:'other'},prior[0].itemId,'explicit loyalty ownership disposal','loyalty-out'));
  await tx(c=>I.transferItem(c,{scope:'account',id:'other'},{scope:'account',id:'buyer'},prior[0].itemId,'explicit loyalty ownership restoration','loyalty-back'));
  assert.equal((await C.consignmentEconomySaleWitness(pool,next.offer.consignmentId)).buyerPaid,91);
  const p3=await act('owner','create',programTerms,'antiwash-program'),fresh=await listing();await unchanged(()=>act('buyer','quote',quoteBody(p3,fresh,prior),'wash'),/purchase_custody/);
  const foreignPrior=await ordinary({buyer:'other'});await unchanged(()=>act('buyer','quote',quoteBody(p3,fresh,[prior[1],foreignPrior]),'foreign-history'),/prior_purchase/);
  const genuine=await ordinary(),rightPrior={consignmentId:genuine.sale.consignmentId,sourceHash:genuine.sale.sourceHash,refundCash:91,lifetimeSeconds:60,consent:true};const reserving=await tx(c=>M.merchantReturnAction(c,'owner','offer',rightPrior,'prior-return-offer',{assertLifecycle:lifecycle}));
  await unchanged(()=>act('buyer','quote',quoteBody(p3,fresh,[prior[1],genuine]),'reserved-history'),/return_right/);
  await tx(c=>M.merchantReturnAction(c,'owner','cancel',{returnId:reserving.returnId,sourceHash:reserving.sourceHash,consent:true},'prior-return-cancel',{assertLifecycle:lifecycle}));
  // Actual cash/journal corruption cannot turn an invented purchase into qualification.
  const journal=(await pool.query("SELECT id FROM transactions WHERE counterparty=$1 AND reason='consignment:purchase'",[genuine.sale.consignmentId])).rows[0];await pool.query('UPDATE transactions SET amount=amount+1 WHERE id=$1',[journal.id]);await unchanged(()=>act('buyer','quote',quoteBody(p3,fresh,[prior[1],genuine]),'bad-journal'),/sale_legs/);await pool.query('UPDATE transactions SET amount=amount - 1 WHERE id=$1',[journal.id]);
  const goodQuote=await act('buyer','quote',quoteBody(p3,fresh,[prior[1],genuine]),'good-repeat'),quoteRow=(await pool.query('SELECT * FROM merchant_loyalty_quotes WHERE id=$1',[goodQuote.quoteId])).rows[0];await pool.query('UPDATE merchant_loyalty_quotes SET buyer_paid=buyer_paid - 1,seller_paid=seller_paid - 1,discount_cash=discount_cash+1 WHERE id=$1',[goodQuote.quoteId]);await unchanged(()=>act('buyer','buy',buyBody(goodQuote),'stored-forgery'),/quote_source/);await pool.query('UPDATE merchant_loyalty_quotes SET buyer_paid=$2,seller_paid=$3,discount_cash=$4 WHERE id=$1',[goodQuote.quoteId,quoteRow.buyer_paid,quoteRow.seller_paid,quoteRow.discount_cash]);
  // Closing prevents fresh spend but never changes previous sale/history/ACK authority.
  await act('owner','close',{programId:program.programId,programSourceHash:program.programSourceHash,consent:true},'close-used');assert.equal((await C.consignmentEconomySaleWitness(pool,next.offer.consignmentId)).sellerPaid,81);assert.deepEqual(await act('buyer','buy',buyBody(quote),'discounted'),paid);
  for(const [n,p]of prior.entries())assert.deepEqual((await pool.query('SELECT settlement FROM consignments WHERE id=$1',[p.sale.consignmentId])).rows[0].settlement,originalReceipts[n]);
  await pool.query("UPDATE accounts SET status='banned' WHERE id='host'");await unchanged(()=>act('buyer','buy',buyBody(goodQuote),'inactive-host'),/account/);await pool.query("UPDATE accounts SET status='active' WHERE id='host'");await books();
  fs.mkdirSync('output',{recursive:true});fs.writeFileSync('output/merchant-loyalty-effect.json',JSON.stringify({phase:f.native?'native-component':'memory-component',program,quote,paid,returned,financialActivation:'off'},null,2));
  console.log('Merchant loyalty '+(f.native?'native18.4':'memory')+' actual canonical gameplay PASS: distinct genuinely paid UID repeats, seller-funded lower buyer/seller3legs, original host fee, sameUID custody, opaque scopes, quotes have zero cash effects, exact ACK, default-closed imports, conflict/poison/late rollback, normalized N10 actual-net cap+return, post-sale history retention, wash/foreign/return-reserve/journal/stored-source refusals. Shared full server/release qualification remains coordinator-owned.');
}finally{await pool.end();}
