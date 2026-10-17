import assert from 'node:assert/strict';
import { fixture } from './shoppingbasket-fixture.js';
const f = await fixture(), { pool, tx, B, pair, quoteBody, ref, act, state, books } = f;
try {
  const originalLines = await pair(), originalQuote = await act('buyer', 'quote', quoteBody(originalLines), 'historical-quote');
  const historical = await act('buyer', 'checkout', ref(originalQuote), 'historical-checkout');
  const lines = await pair(), quoted = await act('buyer', 'quote', quoteBody(lines), 'final-response-quote'), before = await state();
  assert.equal(Object.keys(before).length, 14, 'All original13 tables plus canonical item_stacks are measured');
  let delivered = 0;
  await assert.rejects(tx(async c => {
    const query = c.query.bind(c);
    c.query = async (...args) => {
      const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text, result = await query(...args);
      if (sql?.startsWith('UPDATE shopping_basket_requests SET receipt=')) {
        delivered++;
        assert.equal((await query('SELECT status FROM shopping_baskets WHERE id=$1', [quoted.basketId])).rows[0].status, 'completed');
        assert.equal((await query("SELECT COUNT(*)::int n FROM consignments WHERE (id=$1 OR id=$2) AND status='sold'", lines.map(line => line.offer.consignmentId))).rows[0].n, 2);
        assert.equal((await query('SELECT COUNT(*)::int n FROM transactions WHERE counterparty=$1 OR counterparty=$2', lines.map(line => line.offer.consignmentId))).rows[0].n, 6);
        assert((await query('SELECT receipt FROM shopping_basket_requests WHERE run_id=$1', [args[1][2]])).rows[0].receipt, 'Actual completed ACK was written');
        const started = +new Date((await query('SELECT clock_timestamp() AS now')).rows[0].now);
        assert(started < Date.parse(quoted.expiresAt), 'Real post-write wait begins before actual deadline');
        console.log('Waiting genuine final-ACK response deadline milliseconds', Date.parse(quoted.expiresAt) - started);
        while (Date.now() < Date.parse(quoted.expiresAt) + 100) await new Promise(resolve => setTimeout(resolve, Math.min(10000, Date.parse(quoted.expiresAt) + 100 - Date.now())));
      }
      return result;
    };
    try { return await B.shoppingBasketAction(c, 'buyer', 'checkout', ref(quoted), 'final-response-checkout'); }
    finally { c.query = query; }
  }), /expired/);
  assert.equal(delivered, 1, 'One actual post-write deadline crossing was delivered');
  assert.deepEqual(await state(), before, 'Both actual N01 sales, six journals, two title transfers and ACK undo in all14 measured tables');
  await assert.rejects(act('buyer', 'checkout', ref(quoted), 'final-response-checkout'), /expired/);
  assert.deepEqual(await state(), before, 'Same original key/body after rollback stays expired and makes no effect');
  assert.deepEqual(await act('buyer', 'checkout', ref(originalQuote), 'historical-checkout'), historical, 'Committed historical ACK remains replayable after expiry');
  assert.deepEqual(await state(), before, 'Historical replay never executes another sale');
  const fresh = await act('buyer', 'quote', quoteBody(lines), 'fresh-after-final-response');
  assert.equal((await act('buyer', 'checkout', ref(fresh), 'fresh-after-final-response-checkout')).sales.length, 2);
  await books();
  console.log('Shopping basket final-persistence expiry PASS: actual both sales/6legs/completed ACK before real60s response wait, all14 measured tables rollback, samekey no effect, historical ACK survives and fresh quote buys originals. Memory response-wait proof is not native lock/allocator qualification.');
} finally { await pool.end(); }