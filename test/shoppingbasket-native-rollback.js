import assert from 'node:assert/strict';
import { nativeFixture, observeItemAllocations, assertExactRollback } from './shoppingbasket-native-fixture.js';
const f = await nativeFixture();
try {
  const p = await f.prepare(), body = f.ref(p.quote), faults = [];
  for (const [name, pattern, occurrence, table] of [
    ['first-N01-ACK', /^UPDATE consignment_requests SET receipt=/, 1, 'consignment_requests'],
    ['second-N01-ACK', /^UPDATE consignment_requests SET receipt=/, 2, 'consignment_requests'],
    ['N18-final-ACK', /^UPDATE shopping_basket_requests SET receipt=\$4/, 1, 'shopping_basket_requests'],
  ]) {
    const before = await f.snapshot(), events = []; let reached = 0;
    await assert.rejects(f.tx(c => observeItemAllocations(c, events,
      () => f.B.shoppingBasketAction(c, 'buyer', 'checkout', body, 'native-post-' + name), async (sql, result, args) => {
        if (!pattern.test(sql || '') || ++reached !== occurrence) return;
        assert.equal(result.rowCount, 1);
        const ack = (await c.query('SELECT receipt FROM ' + table + ' WHERE account_id=$1 AND key_hash=$2', args[1].slice(0, 2))).rows[0];
        assert(ack?.receipt, 'The actual ACK UPDATE is already visible on the original client');
        throw Error('N18 actual post-ACK rollback ' + name);
      })), /N18 actual post-ACK rollback/);
    assert.equal(reached, occurrence); assert.equal(events.length, name === 'first-N01-ACK' ? 2 : 4);
    assert.deepEqual(events.map(e => e.event_kind), name === 'first-N01-ACK' ? ['released', 'transferred'] : ['released', 'transferred', 'released', 'transferred']);
    assert(events.every(e => p.lines.some(line => line.itemId === e.item_id))); assertExactRollback(before, await f.snapshot(), events);
    faults.push({ name, actualReceiptWritten: true, events }); await f.books();
  }
  const total = Number((await f.pool.query('SELECT SUM(cash) AS n FROM characters')).rows[0].n);
  const paid = await f.act('buyer', 'checkout', body, 'native-paid'); assert.equal(paid.totalCash, 304); assert.equal(paid.sales.length, 2);
  assert.equal(new Set(paid.sales.flatMap(sale => sale.transactionIds)).size, 6);
  for (const line of p.lines) {
    const witness = await f.C.consignmentEconomySaleWitness(f.pool, line.offer.consignmentId);
    assert.equal(witness.buyerPaid, line.seller === 'seller-a' ? 101 : 203); assert.equal(witness.hostFee, line.seller === 'seller-a' ? 10 : 20);
    assert.equal(witness.sellerPaid, line.seller === 'seller-a' ? 91 : 183);
    assert.equal((await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [line.itemId])).rows[0].owner_id, 'buyer');
  }
  assert.equal(Number((await f.pool.query('SELECT SUM(cash) AS n FROM characters')).rows[0].n), total);
  const stable = await f.snapshot(); assert.deepEqual(await f.act('buyer', 'checkout', body, 'native-paid'), paid); assertExactRollback(stable, await f.snapshot(), []);
  await assert.rejects(f.act('buyer', 'checkout', { ...body, sourceHash: '0'.repeat(64) }, 'native-paid'), /request_conflict/); assertExactRollback(stable, await f.snapshot(), []);
  // Basket history is genuine full-price N01 evidence; any return is a separate
  // original seller's actually funded canonical right, not basket-created cash.
  const sale = paid.sales.find(s => s.consignmentId === p.lines.find(l => l.seller === 'seller-a').offer.consignmentId);
  const terms = { consignmentId: sale.consignmentId, sourceHash: sale.sourceHash, refundCash: 92, lifetimeSeconds: 60, consent: true };
  const lifecycle = c => f.I.assertItemTransaction(c);
  await assert.rejects(f.tx(c => f.M.merchantReturnAction(c, 'seller-a', 'offer', terms, 'native-over-net', { assertLifecycle: lifecycle })), /seller/); assertExactRollback(stable, await f.snapshot(), []);
  const right = await f.tx(c => f.M.merchantReturnAction(c, 'seller-a', 'offer', { ...terms, refundCash: 91 }, 'native-funded-return', { assertLifecycle: lifecycle }));
  assert.deepEqual((await f.pool.query("SELECT character_id,currency,amount FROM transactions WHERE counterparty=$1 AND reason='merchant_return:reserve'", [right.returnId])).rows.map(r => [r.character_id, r.currency, Number(r.amount)]), [['seller-a-actor', 'cash', -91]]);
  const rightBody = { returnId: right.returnId, sourceHash: right.sourceHash, consent: true };
  await f.tx(c => f.M.merchantReturnAction(c, 'buyer', 'accept', rightBody, 'native-return-consent', { assertLifecycle: lifecycle }));
  assert.equal((await f.tx(c => f.M.merchantReturnAction(c, 'buyer', 'return', rightBody, 'native-return-title', { assertLifecycle: lifecycle }))).paidCash, 91);
  assert.equal((await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [sale.itemId])).rows[0].owner_id, 'seller-a');
  assert.equal(Number((await f.pool.query('SELECT SUM(cash) AS n FROM characters')).rows[0].n), total);
  const returned = await f.snapshot(); assert.deepEqual(await f.act('buyer', 'checkout', body, 'native-paid'), paid); assertExactRollback(returned, await f.snapshot(), []);
  console.log(JSON.stringify({ proof: 'N18 actual two-UID/six-leg checkout, three genuine post-ACK full-world faults, exact replay and original funded91 UID return', faults, checks: await f.books() }));
} finally { await f.pool.end(); }
