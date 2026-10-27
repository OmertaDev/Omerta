// Account/day latches for daily rewards whose cash or token value can outlive a character.
// Character rows still carry the work/progress; this table carries only the right to be paid.

export async function accountDailyClaimRows(client, accountId, day, scope) {
  return (await client.query(
    'SELECT claim_id, slot FROM account_daily_claims WHERE account_id=$1 AND day=$2 AND scope=$3 ORDER BY slot, claim_id',
    [accountId, day, scope])).rows;
}

export async function accountDailyClaims(client, accountId, day, scope) {
  const rows = await accountDailyClaimRows(client, accountId, day, scope);
  return new Set(rows.map((row) => row.claim_id));
}

// Resolve a fixed-size board after a same-day deployment changes its semantic ids. Exact ids keep
// their meaning. Each paid slot whose old id is absent from the new board consumes the first still-
// open card, so the board exposes exactly `limit - occupied slots` payable cards and never promises
// work the database cap will refuse. Normal boards (all ids match) are unchanged.
export function resolvedBoundedClaimIds(currentIds, localIds = [], rows = []) {
  const current = new Set(currentIds);
  const claimed = new Set(localIds.filter((id) => current.has(id)));
  let unmatched = 0;
  for (const row of rows) {
    if (current.has(row.claim_id)) claimed.add(row.claim_id);
    else unmatched++;
  }
  for (const id of currentIds) {
    if (unmatched <= 0) break;
    if (!claimed.has(id)) { claimed.add(id); unmatched--; }
  }
  return claimed;
}

export async function takeAccountDailyClaim(client, accountId, day, scope, claimId) {
  const inserted = await client.query(
    `INSERT INTO account_daily_claims (account_id, day, scope, claim_id)
     VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
    [accountId, day, scope, claimId]);
  return inserted.rowCount === 1;
}

// Reserve a bounded set of synthetic/account claim keys in one canonical PK order. Maintenance
// writers use this for batches that can overlap during a rolling deploy; the shared ordering removes
// inverse-key deadlocks, while one INSERT keeps a large repair page below the query-count budget.
export async function takeAccountDailyClaims(client, accountIds, day, scope, claimId) {
  const ordered = [...new Set(accountIds)].sort();
  if (!ordered.length) return 0;
  if (ordered.length > 1000) throw new RangeError('Account daily claim batch exceeds 1000 rows');
  const params = [], values = [];
  for (const accountId of ordered) {
    const offset = params.length;
    params.push(accountId, day, scope, claimId);
    values.push(`($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4})`);
  }
  const inserted = await client.query(
    `INSERT INTO account_daily_claims (account_id, day, scope, claim_id)
     VALUES ${values.join(',')} ON CONFLICT DO NOTHING`, params);
  return inserted.rowCount || 0;
}

// Allocate one of a fixed number of account/day slots while recording the semantic claim id. The
// unique slot index enforces aggregate caps in the database itself, including in pg-mem where
// SELECT FOR UPDATE does not serialize concurrent requests. Different claim ids cannot race past
// the board limit, and the primary key still makes a repeated id lose exactly once.
export async function takeBoundedAccountDailyClaim(client, accountId, day, scope, claimId, limit) {
  for (let slot = 1; slot <= limit; slot++) {
    const inserted = await client.query(
      `INSERT INTO account_daily_claims (account_id, day, scope, claim_id, slot)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [accountId, day, scope, claimId, slot]);
    if (inserted.rowCount === 1) return true;
    const duplicate = await client.query(
      'SELECT 1 FROM account_daily_claims WHERE account_id=$1 AND day=$2 AND scope=$3 AND claim_id=$4',
      [accountId, day, scope, claimId]);
    if (duplicate.rowCount) return false;
  }
  return false;
}
