import crypto from 'node:crypto';
import * as Providers from './resourceproviders.js';
import { resourceError, resourceInt, resourceKey, resourceIntake, resourceMode,
  resourceTransaction, lockResourceTreasury, moveResourceMoney, RESOURCE_MAX } from './resourcebook.js';

const paymentView = row => ({ id: row.id, state: row.state, url: row.checkout_url || null,
  amountUsdMicros: Number(row.amount_usd_micros), mode: row.mode });

function returnUrls() {
  let origin;
  try { origin = new URL(process.env.PUBLIC_URL || 'http://127.0.0.1'); } catch { throw resourceError('configuration', 'Configure a trusted public URL.'); }
  if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password
      || origin.protocol !== 'https:' && (process.env.NODE_ENV === 'production' || resourceMode() === 'live'
        || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname))) {
    throw resourceError('configuration', 'Funding requires a trusted HTTPS public URL.');
  }
  return { successUrl: `${origin.origin}/play?resourceFunding=complete`, cancelUrl: `${origin.origin}/play?resourceFunding=cancelled` };
}

export async function createResourceFunding(pool, accountId, body, { adapter = Providers } = {}) {
  resourceIntake();
  const requestId = resourceKey(body?.requestId);
  const amount = resourceInt(body?.amountUsdMicros, 'funding amount', 10000, 1000000000);
  if (amount % 10000) throw resourceError('terms', 'Funding must use exact USD cents.');
  const urls = returnUrls();
  let payment = await resourceTransaction(pool, async client => {
    const treasury = await lockResourceTreasury(client, accountId);
    let row = (await client.query('SELECT * FROM resource_payments WHERE account_id=$1 AND request_key=$2 FOR UPDATE', [accountId, requestId])).rows[0];
    if (row) {
      if (Number(row.amount_usd_micros) !== amount || row.mode !== resourceMode()) throw resourceError('conflict', 'This funding request already has different terms.');
      return row;
    }
    const pending = (await client.query("SELECT amount_usd_micros FROM resource_payments WHERE account_id=$1 AND state IN ('creating','unknown','pending')", [accountId])).rows;
    const exposure = pending.reduce((total, row) => total + BigInt(row.amount_usd_micros), 0n);
    if (BigInt(treasury.available_usd_micros) + BigInt(treasury.reserved_usd_micros) + exposure + BigInt(amount) > BigInt(RESOURCE_MAX))
      throw resourceError('capacity', 'Existing balances and outstanding checkouts exhaust this treasury capacity.');
    const id = crypto.randomUUID();
    await client.query("INSERT INTO resource_payments(id,account_id,request_key,amount_usd_micros,mode,state) VALUES($1,$2,$3,$4,$5,'creating')", [id, accountId, requestId, amount, resourceMode()]);
    return (await client.query('SELECT * FROM resource_payments WHERE id=$1', [id])).rows[0];
  });
  if (payment.session_id || ['settled', 'refunded', 'disputed'].includes(payment.state)) return { resourceAction: 'funding', payment: paymentView(payment) };
  if (Date.now() - new Date(payment.created_at).getTime() >= 20 * 3600000)
    throw resourceError('recovery', 'An old unresolved checkout requires provider reconciliation before another attempt.');
  // Both ambiguous retries and concurrent requests reuse Stripe's same immutable intent id.
  let session;
  try {
    session = await adapter.createPaymentSession({ id: payment.id, amountUsdMicros: amount, ...urls });
    let checkout;
    try { checkout = new URL(session?.url); } catch { /* Reject below. */ }
    if (!/^cs_[A-Za-z0-9_]+$/.test(session?.sessionId || '') || session.amountUsdMicros !== amount
        || !checkout || checkout.protocol !== 'https:' || checkout.hostname !== 'checkout.stripe.com'
        || checkout.username || checkout.password) throw resourceError('receipt', 'Checkout requires reconciliation.');
  } catch {
    payment = await resourceTransaction(pool, async client => {
      await lockResourceTreasury(client, accountId);
      await client.query("UPDATE resource_payments SET state='unknown' WHERE id=$1 AND state IN ('creating','unknown')", [payment.id]);
      return (await client.query('SELECT * FROM resource_payments WHERE id=$1', [payment.id])).rows[0];
    });
    return { resourceAction: 'funding', payment: paymentView(payment) };
  }
  payment = await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, accountId);
    const row = (await client.query('SELECT * FROM resource_payments WHERE id=$1 FOR UPDATE', [payment.id])).rows[0];
    if (row.session_id && row.session_id !== session.sessionId) throw resourceError('receipt', 'Checkout identity mismatch.');
    if (!row.session_id) await client.query("UPDATE resource_payments SET session_id=$2,checkout_url=$3,state='pending' WHERE id=$1 AND state IN ('creating','unknown')", [payment.id, session.sessionId, session.url]);
    return (await client.query('SELECT * FROM resource_payments WHERE id=$1', [payment.id])).rows[0];
  });
  return { resourceAction: 'funding', payment: paymentView(payment) };
}

export async function settleResourcePayment(pool, rawBuffer, signature, { adapter = Providers } = {}) {
  const event = await adapter.verifyPaymentWebhook(rawBuffer, signature);
  const object = event?.data?.object;
  if (!event || !/^evt_[A-Za-z0-9_]+$/.test(event.id || '') || typeof event.livemode !== 'boolean' || !object) throw resourceError('receipt', 'Invalid verified payment event.');
  const funding = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type);
  const freeze = ['charge.dispute.created', 'charge.refunded'].includes(event.type);
  if (!funding && !freeze) return { ignored: true };
  const intentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
  if (!/^pi_[A-Za-z0-9_]+$/.test(intentId || '')) throw resourceError('receipt', 'Payment intent is missing.');
  const candidate = funding
    ? (await pool.query('SELECT * FROM resource_payments WHERE id=$1', [object.metadata?.resourcePaymentId || ''])).rows[0]
    : (await pool.query('SELECT * FROM resource_payments WHERE payment_intent_id=$1', [intentId])).rows[0];
  if (!candidate) {
    if (funding) throw resourceError('pending', 'Payment binding is not yet available; retry this receipt.');
    return { ignored: true };
  }
  return resourceTransaction(pool, async client => {
    const treasury = (await client.query('SELECT * FROM resource_treasuries WHERE account_id=$1 FOR UPDATE', [candidate.account_id])).rows[0];
    const payment = (await client.query('SELECT * FROM resource_payments WHERE id=$1 FOR UPDATE', [candidate.id])).rows[0];
    if (!treasury || treasury.mode !== payment.mode || event.livemode !== (payment.mode === 'live')
        || typeof object.livemode === 'boolean' && object.livemode !== event.livemode) throw resourceError('mode', 'Receipt payment environment mismatch.');
    if (freeze) {
      if (payment.payment_intent_id !== intentId) throw resourceError('receipt', 'Disputed payment identity mismatch.');
      await client.query('UPDATE resource_treasuries SET frozen=true WHERE account_id=$1', [payment.account_id]);
      await client.query("UPDATE resource_payments SET state='disputed' WHERE id=$1", [payment.id]);
      const eventKey = `payment_event:${event.id}`;
      const recorded = (await client.query('SELECT id FROM resource_ledger WHERE account_id=$1 AND event_key=$2', [payment.account_id, eventKey])).rows[0];
      if (!recorded) await moveResourceMoney(client, payment.account_id, 0, 0, 'payment_dispute', eventKey);
      return { resourceAction: 'funding_frozen', paymentId: payment.id, frozen: true };
    }
    if (!payment.session_id) throw resourceError('pending', 'Checkout binding is pending; retry this receipt.');
    if (object.id !== payment.session_id || object.metadata?.resourcePaymentId !== payment.id
        || object.client_reference_id !== payment.id || object.payment_status !== 'paid' || object.currency !== 'usd'
        || !Number.isSafeInteger(object.amount_total) || object.amount_total * 10000 !== Number(payment.amount_usd_micros)
        || payment.payment_intent_id && payment.payment_intent_id !== intentId) throw resourceError('receipt', 'Checkout receipt terms mismatch.');
    if (['settled', 'disputed', 'refunded'].includes(payment.state)) return { resourceAction: 'funding', payment: paymentView(payment), duplicate: true };
    const reused = (await client.query('SELECT id FROM resource_payments WHERE payment_intent_id=$1 OR stripe_event_id=$2', [intentId, event.id])).rows[0];
    if (reused && reused.id !== payment.id) throw resourceError('receipt', 'Payment receipt was already bound.');
    await moveResourceMoney(client, payment.account_id, Number(payment.amount_usd_micros), 0, 'capital', `payment:${payment.id}`);
    await client.query("UPDATE resource_payments SET state='settled',payment_intent_id=$2,stripe_event_id=$3,settled_at=NOW() WHERE id=$1", [payment.id, intentId, event.id]);
    return { resourceAction: 'funding', payment: paymentView({ ...payment, state: 'settled' }) };
  });
}
