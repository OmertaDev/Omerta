import assert from 'node:assert/strict';
import { fixture } from './shoppingbasket-fixture.js';
const f = await fixture(), { pool, act, pair, quoteBody, ref, state, books } = f;
try {
  const lines = await pair(), body = quoteBody(lines), quotes = [];
  for (let n = 0; n < 3; n++) quotes.push(await act('buyer', 'quote', body, 'bounded-quote-' + n));
  const capped = await state(); await assert.rejects(act('buyer', 'quote', body, 'fourth-quote'), /quote_limit/); assert.deepEqual(await state(), capped);
  const deadline = Math.max(...quotes.map(q => +new Date(q.expiresAt))), observed = +new Date((await pool.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
  const wait = Math.max(0, deadline - observed + 100); console.log('Waiting genuine database-clock quote deadline milliseconds', wait);
  await new Promise(resolve => setTimeout(resolve, wait));
  const expired = await state(); await assert.rejects(act('buyer', 'checkout', ref(quotes[0]), 'expired-checkout'), /expired/); assert.deepEqual(await state(), expired);
  const fresh = await act('buyer', 'quote', body, 'after-expiry'); assert.equal(fresh.status, 'quoted');
  const bought = await act('buyer', 'checkout', ref(fresh), 'fresh-checkout'); assert.equal(bought.sales.length, 2);
  await books(); console.log('Shopping basket real60s expiry PASS: three own quotes only, exact cap refusal, no late money/title effect, expired metadata does not occupy fresh quote capacity or reserve goods.');
} finally { await pool.end(); }
