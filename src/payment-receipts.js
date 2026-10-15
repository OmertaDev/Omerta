import crypto from 'node:crypto';
import { sendTransactionalEmail } from './dispatch.js';

// Use the purchase's transaction client: a receipt becomes visible only when its
// purchase commits. Marketing preferences do not suppress transaction receipts.
export async function queuePaymentReceipt(client, accountId, { kind, amount, durationSeconds, receiptId = crypto.randomUUID() }) {
  const account = (await client.query('SELECT email, email_verified FROM account_persistent WHERE account_id=$1', [accountId])).rows[0];
  if (!account?.email_verified || !account.email) return null;
  await client.query(`INSERT INTO payment_receipts
    (id, account_id, email, kind, amount, duration_seconds) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (id) DO NOTHING`, [receiptId, accountId, account.email, kind, amount, durationSeconds]);
  return receiptId;
}

function receiptMessage(row) {
  const names = { made: 'Made pass', wire: 'Street Wire pass', watch: 'Standing watch' };
  const duration = `${Number(row.duration_seconds) / 3600} hours`;
  const terms = row.kind === 'watch'
    ? `Your standing watch renews every ${duration} using in-game $OMR until cancelled, paused for insufficient funds, or your Wire pass expires. Cancel future charges online: open the Wire tab and choose "drop the watch".`
    : `This purchase adds ${duration}. It expires unless you manually renew; it does not automatically charge again.`;
  const text = `OMERTA purchase confirmation\nReceipt: ${row.id}\n${names[row.kind] || 'Game purchase'}\nCharged: ${Number(row.amount)} in-game $OMR\n${terms}\nPayment and refund terms: https://omerta.fun/terms#payments\nThis is a transaction receipt, not a marketing email.`;
  const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  return { subject: `OMERTA receipt — ${names[row.kind] || 'Game purchase'}`, text, html: `<pre style="white-space:pre-wrap">${escape(text)}</pre>` };
}

// A lease prevents overlapping workers from sending a receipt together. A stable
// provider key also covers delivery succeeding before the worker records success.
export async function sweepPaymentReceipts(pool, { send = sendTransactionalEmail, now = new Date(), limit = 50 } = {}) {
  const due = (await pool.query(`SELECT id FROM payment_receipts
    WHERE sent_at IS NULL AND abandoned_at IS NULL AND next_attempt_at <= $1
      AND (claimed_until IS NULL OR claimed_until <= $1)
    ORDER BY created_at LIMIT $2`, [now, limit])).rows;
  let delivered = 0;
  for (const { id } of due) {
    const lease = crypto.randomUUID();
    const row = (await pool.query(`UPDATE payment_receipts SET lease_id=$2,
      claimed_until=$3, attempts=attempts+1 WHERE id=$1 AND sent_at IS NULL AND abandoned_at IS NULL
      AND next_attempt_at <= $4 AND (claimed_until IS NULL OR claimed_until <= $4)
      RETURNING *`, [id, lease, new Date(now.getTime() + 300000), now])).rows[0];
    if (!row) continue;
    // Resend retains idempotency keys for 24 hours. Stop automatic retries an
    // hour before that window ends rather than risk duplicating an ambiguous send.
    if (row.first_attempt_at && now.getTime() - new Date(row.first_attempt_at).getTime() >= 23 * 3600000) {
      await pool.query('UPDATE payment_receipts SET abandoned_at=$3, claimed_until=NULL, lease_id=NULL WHERE id=$1 AND lease_id=$2', [id, lease, now]);
      continue;
    }
    if (!row.first_attempt_at) {
      await pool.query('UPDATE payment_receipts SET first_attempt_at=$3 WHERE id=$1 AND lease_id=$2', [id, lease, now]);
    }
    let success = false;
    try {
      success = await send({ to: row.email, ...receiptMessage(row), idempotencyKey: `payment-receipt/${row.id}` }) === true;
    } catch { /* Delivery failures retry independently of the committed purchase. */ }
    if (success) {
      await pool.query('UPDATE payment_receipts SET sent_at=$3, claimed_until=NULL, lease_id=NULL WHERE id=$1 AND lease_id=$2', [id, lease, now]);
      delivered++;
    } else {
      const retryAt = new Date(now.getTime() + Math.min(86400000, 60000 * 2 ** Math.min(Number(row.attempts), 10)));
      await pool.query('UPDATE payment_receipts SET next_attempt_at=$3, claimed_until=NULL, lease_id=NULL WHERE id=$1 AND lease_id=$2', [id, lease, retryAt]);
    }
  }
  return delivered;
}
