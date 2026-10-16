import assert from 'node:assert/strict';
import { fixture } from './shoppingbasket-fixture.js';
const f = await fixture(), { pool, tx, I, C, B, listing, pair, quoteBody, ref, act, state, books } = f;
const unchanged = async (fn, pattern) => { const before = await state(); await assert.rejects(fn, pattern); assert.deepEqual(await state(), before); };
try {
  const lines = await pair(), body = quoteBody(lines), initial = await state();
  for (const bad of [{ ...body, callback: 'none' }, { ...body, loyaltyContext: {} }, { ...body, lines: body.lines.slice(0, 1) }, { ...body, consent: false }]) await unchanged(() => act('buyer', 'quote', bad), /terms/);
  await unchanged(() => act('buyer', 'quote', { ...body, lines: [body.lines[0], body.lines[0]] }), /distinct_lines/);
  await unchanged(() => act('seller-a', 'quote', body), /distinct_originals/);
  const quoted = await act('buyer', 'quote', body, 'quote'), afterQuote = await state();
  assert.equal(quoted.totalCash, 304); assert.equal(quoted.lines.length, 2);
  for (const table of ['characters', 'transactions', 'item_instances', 'item_events', 'operation_escrow']) assert.deepEqual(afterQuote[table], initial[table], 'Quote reserves no ' + table);
  assert.deepEqual(await act('buyer', 'quote', { ...body, lines: [...body.lines].reverse() }, 'quote'), quoted, 'Input line order cannot change request semantics');
  assert(!JSON.stringify(quoted).includes('seller-a-actor')); assert(!JSON.stringify(quoted).includes(lines[0].itemId));
  await unchanged(() => act('other', 'checkout', ref(quoted), 'foreign'), /buyer/);
  await unchanged(() => tx(c => B.assertShoppingBasketPurchaseScope(c, {}, body.lines[0].consignmentId, body.lines[0].sourceHash, 'buyer')), /purchase_scope/);
  await unchanged(() => tx(c => C.buyConsignmentWithBasketContext(c, 'buyer', lines[0].body, 'forged-direct', {})), /purchase_scope/);
  const audit = f.native ? await (await import('../tools/rc1-native-proof.js')).canonicalDatabaseSnapshot(pool) : null;
  await unchanged(() => tx(async c => { await B.shoppingBasketAction(c, 'buyer', 'checkout', ref(quoted), 'late'); throw Error('after actual two-line checkout'); }), /after actual two-line checkout/);
  if (f.native) {
    const restored = await (await import('../tools/rc1-native-proof.js')).canonicalDatabaseSnapshot(pool);
    assert.deepEqual(restored.tables, audit.tables); assert.deepEqual(restored.sequences, audit.sequences.map(row => row.sequencename === 'item_events_sequence_seq' ? { ...row, last_value: String(BigInt(row.last_value) + 4n) } : row));
  }
  const paid = await act('buyer', 'checkout', ref(quoted), 'checkout'); assert.equal(paid.status, 'completed'); assert.equal(paid.sales.length, 2);
  assert.equal(paid.sales.reduce((sum, sale) => sum + sale.paid, 0), 304); assert.equal(new Set(paid.sales.flatMap(sale => sale.transactionIds)).size, 6);
  for (const line of lines) {
    assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [line.itemId])).rows[0].owner_id, 'buyer');
    const rows = (await pool.query('SELECT amount FROM transactions WHERE counterparty=$1 ORDER BY reason', [line.offer.consignmentId])).rows;
    assert.deepEqual(rows.map(row => Number(row.amount)), line.seller === 'seller-a' ? [10, 91, -101] : [20, 183, -203]);
  }
  assert.equal(Number((await pool.query("SELECT cash FROM characters WHERE id='buyer-actor'")).rows[0].cash), 9696);
  assert.equal(Number((await pool.query("SELECT cash FROM characters WHERE id='host-actor'")).rows[0].cash), 10030);
  const done = await state(); assert.deepEqual(await act('buyer', 'checkout', ref(quoted), 'checkout'), paid); assert.deepEqual(await state(), done);
  await unchanged(() => act('buyer', 'checkout', ref(quoted), 'again'), /closed/);
  await unchanged(() => act('buyer', 'checkout', { ...ref(quoted), sourceHash: '0'.repeat(64) }, 'checkout'), /request_conflict/);
  const witness = await C.consignmentEconomySaleWitness(pool, paid.sales[0].consignmentId);
  await unchanged(() => tx(c => C.assertFreshConsignmentBasketProof(c, witness, {})), /fresh_basket_sale_proof/);
  await books();
  // Earned checkout history survives a later legitimate title disposal.
  await tx(c => I.transferItem(c, { scope: 'account', id: 'buyer' }, { scope: 'account', id: 'other' }, lines[0].itemId, 'explicit purchased basket tool disposal', 'basket-disposal'));
  await books(); assert.deepEqual(await act('buyer', 'checkout', ref(quoted), 'checkout'), paid);
  const sameSeller = [await listing('seller-a'), await listing('seller-a')]; await unchanged(() => act('buyer', 'quote', quoteBody(sameSeller)), /consenting_lines/);
  const differentHost = [await listing('seller-a'), await listing('seller-b', 203, 'host-two')]; await unchanged(() => act('buyer', 'quote', quoteBody(differentHost)), /consenting_lines/);
  const unaccepted = [await listing('seller-a'), await listing('seller-b', 203, 'host', false)]; await unchanged(() => act('buyer', 'quote', quoteBody(unaccepted)), /consenting_lines/);
  const cancelLines = await pair(), cancel = await act('buyer', 'quote', quoteBody(cancelLines));
  assert.equal((await act('buyer', 'cancel', ref(cancel))).status, 'cancelled'); await unchanged(() => act('buyer', 'checkout', ref(cancel)), /closed/);
  await books(); console.log('Shopping basket actual canonical memory PASS: two distinct sellers/common host/four originals, real2UID/6journals, zero-reserve quote, closed consent, full late rollback, exact ACK/history, no optional-pricing or foreign capability.');
} finally { await (f.app ? f.app.close() : pool.end()); }
