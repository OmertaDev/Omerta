import assert from 'node:assert/strict';
import { nativeFixture, observeItemAllocations, assertExactRollback } from './shoppingbasket-native-fixture.js';
const f = await nativeFixture();
try {
  const historical = await f.prepare(), history = await f.act('buyer', 'checkout', f.ref(historical.quote), 'native-history'), p = await f.prepare();
  const before = await f.snapshot(), events = [], reads = [], deadline = Date.parse(p.quote.expiresAt), started = Date.now(); let reached = 0;
  await assert.rejects(f.tx(c => observeItemAllocations(c, events,
    () => f.B.shoppingBasketAction(c, 'buyer', 'checkout', f.ref(p.quote), 'native-post-final-ACK-expiry'), async (sql, result, args) => {
      if (!/^UPDATE shopping_basket_requests SET receipt=\$4/.test(sql || '')) return;
      assert.equal(result.rowCount, 1); assert.equal(++reached, 1);
      assert((await c.query('SELECT receipt FROM shopping_basket_requests WHERE account_id=$1 AND key_hash=$2', args[1].slice(0, 2))).rows[0]?.receipt);
      assert.equal((await c.query('SELECT status FROM shopping_baskets WHERE id=$1', [p.quote.basketId])).rows[0].status, 'completed');
      assert.equal((await c.query("SELECT COUNT(*)::int n FROM consignments WHERE id=ANY($1::text[]) AND status='sold'", [p.lines.map(l => l.offer.consignmentId)])).rows[0].n, 2);
      assert.equal((await c.query('SELECT COUNT(*)::int n FROM transactions WHERE counterparty=ANY($1::text[])', [p.lines.map(l => l.offer.consignmentId)])).rows[0].n, 6);
      const first = +new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed); assert(first < deadline, 'Both actual sales and ACK preceded the immutable real deadline');
      const timeout = Date.now() + 75000;
      while (true) {
        const at = +new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed); reads.push(new Date(at).toISOString());
        if (at > deadline + 150) break;
        assert(Date.now() < timeout, 'Real server clock must progress'); await new Promise(resolve => setTimeout(resolve, Math.min(10000, Math.max(1, deadline + 151 - at))));
      }
    })), error => error.code === 'shopping_basket' && error.message === 'expired');
  assert.equal(reached, 1); assert(reads.length >= 2); assert.deepEqual(events.map(e => e.event_kind), ['released', 'transferred', 'released', 'transferred']);
  assertExactRollback(before, await f.snapshot(), events); await f.books();
  const stable = await f.snapshot(); await assert.rejects(f.act('buyer', 'checkout', f.ref(p.quote), 'native-post-final-ACK-expiry'), /expired/); assertExactRollback(stable, await f.snapshot(), []);
  assert.deepEqual(await f.act('buyer', 'checkout', f.ref(historical.quote), 'native-history'), history); assertExactRollback(stable, await f.snapshot(), []);
  const fresh = await f.act('buyer', 'quote', f.quoteBody(p.lines), 'native-fresh-after-expiry'); assert.equal((await f.act('buyer', 'checkout', f.ref(fresh), 'native-fresh-checkout')).sales.length, 2);
  console.log(JSON.stringify({ proof: 'N18 actual two sales/six journals/final persisted ACK before genuine immutable60s deadline crossing; whole-world undo, samekey refusal, history and fresh original UIDs', deadline: p.quote.expiresAt, elapsedMs: Date.now() - started, actualReadOnlyKeepalives: reads, events, checks: await f.books() }));
} finally { await f.pool.end(); }
