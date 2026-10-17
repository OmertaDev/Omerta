import assert from 'node:assert/strict';
import { fixture } from './shoppingbasket-fixture.js';
const f = await fixture(), { pool, tx, B, C, pair, quoteBody, ref, act, state, books } = f;
try {
  const lines = await pair(), quoted = await act('buyer', 'quote', quoteBody(lines), 'atomic-quote');
  const first = lines.find(line => line.offer.consignmentId === quoted.lines[0].consignmentId), second = lines.find(line => line.offer.consignmentId === quoted.lines[1].consignmentId);
  const condition = (await pool.query('SELECT * FROM item_durability_states WHERE item_id=$1', [second.itemId])).rows[0];
  // Explicit NEGATIVE condition fixture; no positive purchase or source proof is synthesized.
  if (condition) await pool.query('UPDATE item_durability_states SET remaining=0 WHERE item_id=$1', [second.itemId]);
  else {
    const creation = (await pool.query("SELECT id FROM item_events WHERE item_id=$1 AND event_kind='created'", [second.itemId])).rows;
    assert.equal(creation.length, 1);
    await pool.query('INSERT INTO item_durability_states(item_id,creation_event,remaining,revision) VALUES($1,$2,0,1)', [second.itemId, creation[0].id]);
  }
  const before = await state(), audit = f.native ? await (await import('../tools/rc1-native-proof.js')).canonicalDatabaseSnapshot(pool) : null;
  let observedFirst = false;
  await assert.rejects(tx(async c => {
    try { await B.shoppingBasketAction(c, 'buyer', 'checkout', ref(quoted), 'second-leaf-failure'); }
    catch (error) {
      assert.match(error.message, /broken/);
      assert.equal((await c.query('SELECT status FROM consignments WHERE id=$1', [first.offer.consignmentId])).rows[0].status, 'sold');
      assert.equal((await c.query('SELECT owner_id FROM item_instances WHERE id=$1', [first.itemId])).rows[0].owner_id, 'buyer');
      const legs = (await c.query('SELECT amount FROM transactions WHERE counterparty=$1 ORDER BY reason', [first.offer.consignmentId])).rows;
      assert.equal(legs.length, 3); assert.equal(legs.reduce((sum, leg) => sum + Number(leg.amount), 0), 0);
      assert.equal((await c.query('SELECT status FROM consignments WHERE id=$1', [second.offer.consignmentId])).rows[0].status, 'active');
      observedFirst = true; throw error;
    }
  }), /broken/);
  assert(observedFirst, 'Observed actual first UID title and three real journals before genuine second-leaf refusal');
  assert.deepEqual(await state(), before, 'Second-leaf failure rolls back first sale, all money/title/requests and basket');
  if (f.native) {
    const after = await (await import('../tools/rc1-native-proof.js')).canonicalDatabaseSnapshot(pool);
    assert.deepEqual(after.tables, audit.tables); assert.deepEqual(after.sequences, audit.sequences.map(row => row.sequencename === 'item_events_sequence_seq' ? { ...row, last_value: String(BigInt(row.last_value) + 2n) } : row));
  }
  if (condition) await pool.query('UPDATE item_durability_states SET remaining=$2 WHERE item_id=$1', [second.itemId, condition.remaining]);
  else await pool.query('DELETE FROM item_durability_states WHERE item_id=$1', [second.itemId]);
  assert.equal((await act('buyer', 'checkout', ref(quoted), 'second-leaf-failure')).status, 'completed', 'Original outer key retries fresh after rollback');
  await books();

  const expensive = [await f.listing('seller-a', 6000), await f.listing('seller-b', 6000)], tooMuch = await act('buyer', 'quote', quoteBody(expensive));
  assert.equal(tooMuch.totalCash, 12000); const funds = await state();
  await assert.rejects(act('buyer', 'checkout', ref(tooMuch)), /cash/); assert.deepEqual(await state(), funds);
  await act('buyer', 'cancel', ref(tooMuch));
  for (const line of expensive) await tx(c => C.cancelConsignment(c, line.seller, line.body, 'expensive-close-' + line.n));

  const changed = await pair(), changing = await act('buyer', 'quote', quoteBody(changed)), target = changed[1];
  await pool.query('UPDATE consignments SET price=price+1 WHERE id=$1', [target.offer.consignmentId]);
  const badPrice = await state(); await assert.rejects(act('buyer', 'checkout', ref(changing)), /source/); assert.deepEqual(await state(), badPrice);
  await pool.query('UPDATE consignments SET price=price - 1 WHERE id=$1', [target.offer.consignmentId]);
  await pool.query('UPDATE consignments SET item_id=$2 WHERE id=$1', [target.offer.consignmentId, first.itemId]);
  const badUid = await state(); await assert.rejects(act('buyer', 'checkout', ref(changing)), /source/); assert.deepEqual(await state(), badUid);
  await pool.query('UPDATE consignments SET item_id=$2 WHERE id=$1', [target.offer.consignmentId, target.itemId]);
  await tx(c => C.cancelConsignment(c, target.seller, target.body, 'public-original-cancel'));
  const closed = await state(); await assert.rejects(act('buyer', 'checkout', ref(changing)), /consenting_lines/); assert.deepEqual(await state(), closed);
  await act('buyer', 'cancel', ref(changing)); await tx(c => C.cancelConsignment(c, changed[0].seller, changed[0].body, 'other-line-cleanup'));

  const contested = await pair(), buyerQuote = await act('buyer', 'quote', quoteBody(contested)), otherQuote = await act('other', 'quote', quoteBody(contested));
  if (f.native) {
    const results = await Promise.allSettled([act('buyer', 'checkout', ref(buyerQuote), 'race-buyer'), act('other', 'checkout', ref(otherQuote), 'race-other')]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  } else {
    await act('buyer', 'checkout', ref(buyerQuote), 'race-buyer'); const winner = await state();
    await assert.rejects(act('other', 'checkout', ref(otherQuote), 'race-other'), /consenting_lines/); assert.deepEqual(await state(), winner);
  }
  await books();
  console.log('Shopping basket atomicity PASS: first real UID/3journals observed before second actual broken-tool leaf; full rollback and original-key retry, aggregate insufficient funds, price/UID/source closure, one buyer outcome. Native races/full-world allocator ' + (f.native ? 'PASS' : 'NOT RUN') + '.');
} finally { await pool.end(); }
