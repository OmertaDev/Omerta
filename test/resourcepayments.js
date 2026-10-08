import assert from 'node:assert/strict';
import { commandDatabase, addPlayer, postgres } from './lib/player-command-support.js';
import { createResourceFunding, settleResourcePayment } from '../src/resourcepayments.js';
import { resourceTransaction, lockResourceTreasury, moveResourceMoney } from '../src/resourcebook.js';
process.env.RESOURCE_ECONOMY = 'on';
process.env.RESOURCE_PAYMENTS_MODE = 'test';
process.env.PUBLIC_URL = 'https://omerta.test/nested?untrusted=ignored';
const db = await commandDatabase('resourcepayments');
const { pool } = db;
const sessions = new Map(); const sent = [];
let next = 0; let ambiguous = false; let early = false;
const adapter = {
  async createPaymentSession(options) {
    sent.push(options);
    if (ambiguous) { ambiguous = false; throw new Error('unknown send'); }
    if (!sessions.has(options.id)) sessions.set(options.id, { sessionId: `cs_test_${++next}`, url: `https://checkout.stripe.com/c/test${next}`, amountUsdMicros: options.amountUsdMicros });
    if (early) {
      early = false;
      await assert.rejects(() => settleResourcePayment(pool, Buffer.from('{}'), 'signed', { adapter: {
        ...adapter, verifyPaymentWebhook: () => event(options.id, sessions.get(options.id).sessionId, options.amountUsdMicros),
      } }), error => error.code === 'resource_pending');
    }
    return sessions.get(options.id);
  },
  verifyPaymentWebhook(raw, signature) {
    if (signature !== 'signed') throw new Error('unsigned');
    return JSON.parse(raw.toString());
  },
};
function event(id, sessionId, amount, extras = {}) {
  return { id: `evt_${id.replaceAll('-', '')}`, type: 'checkout.session.completed', livemode: false,
    data: { object: { id: sessionId, metadata: { resourcePaymentId: id }, client_reference_id: id,
      payment_status: 'paid', currency: 'usd', amount_total: amount / 10000,
      payment_intent: `pi_${id.replaceAll('-', '')}` } }, ...extras };
}
const settle = data => settleResourcePayment(pool, Buffer.from(JSON.stringify(data)), 'signed', { adapter });
try {
  await addPlayer(pool, 'payment-owner', 'Payment Owner');
  const body = { requestId: 'first', amountUsdMicros: 1000000 };
  early = true;
  const funding = await createResourceFunding(pool, 'payment-owner', body, { adapter });
  assert.equal(funding.payment.state, 'pending');
  assert.equal(funding.payment.mode, 'test');
  assert.equal(sent[0].successUrl, 'https://omerta.test/play?resourceFunding=complete');
  assert.equal(sent[0].cancelUrl, 'https://omerta.test/play?resourceFunding=cancelled');
  assert.deepEqual(await createResourceFunding(pool, 'payment-owner', body, { adapter }), funding);
  assert.equal(sent.length, 1);
  await assert.rejects(() => createResourceFunding(pool, 'payment-owner', { ...body, amountUsdMicros: 2000000 }, { adapter }), error => error.code === 'resource_conflict');
  const receipt = event(funding.payment.id, sessions.get(funding.payment.id).sessionId, body.amountUsdMicros);
  await assert.rejects(() => settleResourcePayment(pool, Buffer.from(JSON.stringify(receipt)), 'unsigned', { adapter }));
  for (const patch of [{ currency: 'eur' }, { amount_total: 1 }, { payment_status: 'unpaid' }, { id: 'cs_other' },
    { metadata: { resourcePaymentId: 'wrong' } }, { client_reference_id: 'wrong' }]) {
    await assert.rejects(() => settle({ ...receipt, data: { object: { ...receipt.data.object, ...patch } } }));
  }
  await assert.rejects(() => settle({ ...receipt, livemode: true }), error => error.code === 'resource_mode');
  process.env.RESOURCE_ECONOMY = 'off';
  process.env.RESOURCE_PAYMENTS_MODE = 'live'; // Existing receipt recovery uses its snapshot, not today's mode.
  assert.equal((await settle(receipt)).payment.state, 'settled');
  assert.equal((await settle({ ...receipt, id: 'evt_second', type: 'checkout.session.async_payment_succeeded' })).duplicate, true);
  assert.equal(Number((await pool.query('SELECT available_usd_micros FROM resource_treasuries WHERE account_id=$1', ['payment-owner'])).rows[0].available_usd_micros), 1000000);
  assert.equal((await pool.query("SELECT id FROM resource_ledger WHERE account_id=$1 AND kind='capital'", ['payment-owner'])).rows.length, 1);
  process.env.RESOURCE_ECONOMY = 'on'; process.env.RESOURCE_PAYMENTS_MODE = 'test';
  ambiguous = true;
  const unknown = await createResourceFunding(pool, 'payment-owner', { requestId: 'retry', amountUsdMicros: 20000 }, { adapter });
  assert.equal(unknown.payment.state, 'unknown');
  const recovered = await createResourceFunding(pool, 'payment-owner', { requestId: 'retry', amountUsdMicros: 20000 }, { adapter });
  assert.equal(recovered.payment.id, unknown.payment.id);
  assert.equal(sent.at(-1).id, sent.at(-2).id);
  await addPlayer(pool, 'payment-capacity', 'Capacity Owner');
  await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, 'payment-capacity');
    await moveResourceMoney(client, 'payment-capacity', 1000000000000 - 20000, 0, 'capital', 'capacity:capital');
  });
  await createResourceFunding(pool, 'payment-capacity', { requestId: 'headroom', amountUsdMicros: 20000 }, { adapter });
  const capacitySends = sent.length;
  await assert.rejects(() => createResourceFunding(pool, 'payment-capacity', { requestId: 'excess', amountUsdMicros: 10000 }, { adapter }), e => e.code === 'resource_capacity');
  assert.equal(sent.length, capacitySends, 'pending exposure is checked before remote checkout');
  ambiguous = true;
  const old = await createResourceFunding(pool, 'payment-owner', { requestId: 'old', amountUsdMicros: 10000 }, { adapter });
  await pool.query('UPDATE resource_payments SET created_at=$2 WHERE id=$1', [old.payment.id, new Date(Date.now() - 21 * 3600000)]);
  const oldSends = sent.length;
  await assert.rejects(() => createResourceFunding(pool, 'payment-owner', { requestId: 'old', amountUsdMicros: 10000 }, { adapter }), e => e.code === 'resource_recovery');
  assert.equal(sent.length, oldSends, 'old unknown checkout cannot create a new provider session');
  if (postgres) {
    const paid = event(recovered.payment.id, sessions.get(recovered.payment.id).sessionId, 20000);
    await Promise.all([settle(paid), settle({ ...paid, id: 'evt_concurrent' })]);
    assert.equal((await pool.query("SELECT id FROM resource_ledger WHERE event_key=$1", [`payment:${recovered.payment.id}`])).rows.length, 1);
  }
  const chargeback = { id: 'evt_disputed', type: 'charge.dispute.created', livemode: false,
    data: { object: { payment_intent: receipt.data.object.payment_intent } } };
  assert.equal((await settle(chargeback)).frozen, true);
  await settle(chargeback);
  assert.equal((await pool.query('SELECT frozen FROM resource_treasuries WHERE account_id=$1', ['payment-owner'])).rows[0].frozen, true);
  assert.equal((await pool.query('SELECT state FROM resource_payments WHERE id=$1', [funding.payment.id])).rows[0].state, 'disputed');
  assert.equal(Number((await pool.query('SELECT available_usd_micros FROM resource_treasuries WHERE account_id=$1', ['payment-owner'])).rows[0].available_usd_micros), postgres ? 1020000 : 1000000);
  assert.equal((await pool.query("SELECT id FROM resource_ledger WHERE event_key='payment_event:evt_disputed'")).rows.length, 1);
  assert.deepEqual(await settle({ ...receipt, type: 'unrelated.event' }), { ignored: true });
  for (const amountUsdMicros of [0, 10001, 1e9 + 10000, 1.5]) await assert.rejects(() => createResourceFunding(pool, 'payment-owner', { requestId: 'invalid', amountUsdMicros }, { adapter }));
  process.env.PUBLIC_URL = 'http://example.com';
  await assert.rejects(() => createResourceFunding(pool, 'payment-owner', body, { adapter }));
  console.log(`resourcepayments: signed binding, settlement, recovery, deduplication and freezing passed${postgres ? ' (PostgreSQL concurrency)' : ''}`);
} finally { await db.cleanup(pool); }
