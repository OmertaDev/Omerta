import assert from 'node:assert/strict';
import { nativeFixture, observeItemAllocations, assertExactRollback } from "./merchantloyalty-current-native-fixture.js";
const f = await nativeFixture();
try {
  const p = await f.prepare(), body = f.buyBody(p.quote), before = await f.snapshot();
  await assert.rejects(f.act('buyer','buy',{...body,quoteSourceHash:'0'.repeat(64)},'native-wrong-source'), /quote_source/);
  assertExactRollback(before, await f.snapshot(), []);
  const faults = [];
  for (const [name, pattern, table] of [
    ['actual-N01-ACK', /UPDATE consignment_requests SET receipt=/, 'consignment_requests'],
    ['actual-N17-final-ACK', /UPDATE merchant_loyalty_requests SET receipt=\$4/, 'merchant_loyalty_requests'],
  ]) {
    const original = await f.snapshot(), events = []; let reached = 0;
    await assert.rejects(f.tx(c => observeItemAllocations(c, events,
      () => f.L.merchantLoyaltyAction(c,'buyer','buy',body,'native-post-'+name), async (sql,result,args) => {
        if (!pattern.test(sql || '')) return;
        assert.equal(result.rowCount, 1); reached++;
        const ack = (await c.query('SELECT receipt FROM '+table+' WHERE account_id=$1 AND key_hash=$2', args[1].slice(0,2))).rows[0];
        assert(ack?.receipt, 'The actual receipt UPDATE must already be visible on the genuine client');
        throw Error('N17 actual post-ACK rollback '+name);
      })), /N17 actual post-ACK rollback/);
    assert.equal(reached, 1); assert.deepEqual(events.map(e=>e.event_kind), ['released','transferred']);
    assert(events.every(e=>e.item_id===p.listing.itemId)); assertExactRollback(original, await f.snapshot(), events);
    faults.push({name,actualReceiptWritten:true,events}); await f.books();
  }
  const total = Number((await f.pool.query('SELECT SUM(cash) AS n FROM characters')).rows[0].n);
  const paid = await f.act('buyer','buy',body,'native-paid'); assert.equal(paid.sale.paid,91); assert.equal(paid.sale.hostFee,10);
  assert.equal(Number((await f.pool.query('SELECT SUM(cash) AS n FROM characters')).rows[0].n), total);
  const witness = await f.C.consignmentEconomySaleWitness(f.pool,p.listing.offer.consignmentId);
  assert.equal(witness.buyerPaid,91); assert.equal(witness.hostFee,10); assert.equal(witness.sellerPaid,81);
  const legs = (await f.pool.query('SELECT character_id,currency,reason,amount FROM transactions WHERE counterparty=$1 ORDER BY reason',[p.listing.offer.consignmentId])).rows;
  assert.deepEqual(legs.map(r=>[r.character_id,r.currency,r.reason,Number(r.amount)]),[
    ['host-actor','cash','consignment:host_fee',10],['owner-actor','cash','consignment:proceeds',81],['buyer-actor','cash','consignment:purchase',-91],
  ]);
  const stable = await f.snapshot(); assert.deepEqual(await f.act('buyer','buy',body,'native-paid'),paid); assertExactRollback(stable,await f.snapshot(),[]);
  await assert.rejects(f.act('buyer','buy',{...body,quoteSourceHash:'0'.repeat(64)},'native-paid'),/request_conflict/); assertExactRollback(stable,await f.snapshot(),[]);
  const offer = {consignmentId:paid.sale.consignmentId,sourceHash:paid.sale.sourceHash,refundCash:82,lifetimeSeconds:60,consent:true};
  const lifecycle = c=>f.I.assertItemTransaction(c);
  await assert.rejects(f.tx(c=>f.M.merchantReturnAction(c,'owner','offer',offer,'native-over-net',{assertLifecycle:lifecycle})),/seller/); assertExactRollback(stable,await f.snapshot(),[]);
  const right = await f.tx(c=>f.M.merchantReturnAction(c,'owner','offer',{...offer,refundCash:81},'native-funded-return',{assertLifecycle:lifecycle}));
  const rightBody = {returnId:right.returnId,sourceHash:right.sourceHash,consent:true};
  const funding = (await f.pool.query("SELECT character_id,currency,amount FROM transactions WHERE counterparty=$1 AND reason='merchant_return:reserve'",[right.returnId])).rows;
  assert.deepEqual(funding.map(r=>[r.character_id,r.currency,Number(r.amount)]),[['owner-actor','cash',-81]]);
  await f.tx(c=>f.M.merchantReturnAction(c,'buyer','accept',rightBody,'native-return-consent',{assertLifecycle:lifecycle}));
  const returned = await f.tx(c=>f.M.merchantReturnAction(c,'buyer','return',rightBody,'native-return-title',{assertLifecycle:lifecycle}));
  assert.equal(returned.paidCash,81); assert.equal((await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1',[p.listing.itemId])).rows[0].owner_id,'owner');
  assert.equal((await f.C.consignmentEconomySaleWitness(f.pool,paid.sale.consignmentId)).sellerPaid,81);
  assert.equal(Number((await f.pool.query('SELECT SUM(cash) AS n FROM characters')).rows[0].n),total);
  console.log(JSON.stringify({proof:'N17 genuine three-leg discount, actual N01+N17 post-ACK full-world rollback, original funded81 return and exact replay',faults,checks:await f.books()}));
} finally { await f.pool.end(); }
