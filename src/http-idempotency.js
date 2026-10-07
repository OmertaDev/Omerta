// Retry only the original owner's receipt write. A lost acknowledgement must
// never let a delayed callback release or finalize a replacement reservation.
import { isDbDown } from './dbhealth.js';

async function retryReceiptQuery(query) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await query();
    } catch (error) {
      if (attempt === 2 || !isDbDown(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, [25, 75][attempt]));
    }
  }
}

export function readHttpIdempotency(pool, accountId, key) {
  return retryReceiptQuery(() => pool.query(
    'SELECT status, body_hash, response FROM idempotency WHERE account_id=$1 AND key=$2', [accountId, key]));
}

export function finalizeHttpIdempotency(pool, { accountId, key, bodyHash, reservationToken }, outcome) {
  return retryReceiptQuery(() => outcome.status >= 200 && outcome.status < 300
    ? pool.query(
      'UPDATE idempotency SET status=$3, response=$4 WHERE account_id=$1 AND key=$2 AND body_hash=$5 AND status=0 AND response=$6',
      [accountId, key, outcome.status, outcome.response, bodyHash, reservationToken])
    : pool.query(
      'DELETE FROM idempotency WHERE account_id=$1 AND key=$2 AND body_hash=$3 AND status=0 AND response=$4',
      [accountId, key, bodyHash, reservationToken]));
}
