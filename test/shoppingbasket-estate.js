import assert from 'node:assert/strict';
import { fixture } from './shoppingbasket-fixture.js';
import { runEstate } from '../src/social/estate.js';
const f = await fixture(), { pool, G, B, act, pair, quoteBody, ref, state, books } = f;
try {
  const paidLines = await pair(), paidQuote = await act('buyer', 'quote', quoteBody(paidLines), 'estate-paid-quote');
  const paid = await act('buyer', 'checkout', ref(paidQuote), 'estate-paid');
  const pendingLines = await pair(), pending = await act('buyer', 'quote', quoteBody(pendingLines), 'estate-pending-quote');
  await G.withTwoCharacters(pool, 'other', 'seller-a-actor', (_actor, victim, c, h) => runEstate(c, h, victim, 'actual basket seller death'), { meet: false });
  assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [pendingLines[0].itemId])).rows[0].owner_id, 'seller-a');
  assert.equal((await pool.query('SELECT status FROM consignments WHERE id=$1', [pendingLines[0].offer.consignmentId])).rows[0].status, 'party_dead');
  const deadSeller = await state(); await assert.rejects(act('buyer', 'checkout', ref(pending), 'dead-seller'), /original_actor/); assert.deepEqual(await state(), deadSeller);
  await act('buyer', 'cancel', ref(pending), 'cancel-metadata-only');
  assert.deepEqual(await act('buyer', 'checkout', ref(paidQuote), 'estate-paid'), paid); await books();

  const next = [await f.listing('seller-b'), await f.listing('other')], buyerQuote = await act('buyer', 'quote', quoteBody(next), 'before-buyer-death');
  await G.withTwoCharacters(pool, 'host-two', 'buyer-actor', (_actor, victim, c, h) => runEstate(c, h, victim, 'actual basket buyer death'), { meet: false });
  const heirs = (await pool.query("SELECT id FROM characters WHERE account_id='buyer' AND alive=true")).rows; assert.equal(heirs.length, 1); assert.notEqual(heirs[0].id, 'buyer-actor');
  const deadBuyer = await state(); await assert.rejects(act('buyer', 'checkout', ref(buyerQuote), 'heir-fresh-checkout'), /original_actor/); assert.deepEqual(await state(), deadBuyer);
  assert.deepEqual(await act('buyer', 'quote', quoteBody(next), 'before-buyer-death'), buyerQuote, 'Historical quote ACK has no new authority');
  assert.deepEqual(await act('buyer', 'checkout', ref(paidQuote), 'estate-paid'), paid, 'Historical purchased receipt ACK does not spend for heir');
  await books(); assert.deepEqual(await B.collectShoppingBasketIssues(pool), []);
  console.log('Shopping basket genuine canonical estate PASS: unpaid quote adds no reserves/roots/cash recovery, ordinary original seller UID recovery unchanged, dead/heir fresh spend denied, completed history and exact original ACK preserved. Native full-world estate rollback NOT claimed.');
} finally { await pool.end(); }
