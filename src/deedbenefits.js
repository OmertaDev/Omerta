import { levelOf } from './rules.js';

export const DEED_BENEFITS_MIN_LEVEL = 25;

// Additive boot migration, before serving requests and before the RLS sweep. The caller owns
// the transaction; failed startup rolls the table back and a restart safely replays it.
export async function migrateDeedBenefitStorage(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS street_deed_benefit_eligibility (
    character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
    eligible_at TIMESTAMPTZ NOT NULL
  )`);
}

// Eligibility belongs to this life. Inherited or purchased property cannot bank rewards before
// level 25. A read may preview its starting clock but cannot initialize or backdate the marker.
export async function deedBenefitEligibilityAt(client, ch, now = Date.now()) {
  if (ch?.alive !== true || !ch.id || levelOf(Number(ch.respect || 0)) < DEED_BENEFITS_MIN_LEVEL) return null;
  const row = (await client.query(
    'SELECT eligible_at FROM street_deed_benefit_eligibility WHERE character_id=$1', [ch.id])).rows[0];
  return row ? new Date(row.eligible_at) : new Date(now);
}

// Character persistence runs inside its write transaction, including the action crossing level 25.
export async function recordDeedBenefitEligibility(client, ch, now = Date.now()) {
  if (ch?.alive !== true || !ch.id) return;
  if (levelOf(Number(ch.respect || 0)) < DEED_BENEFITS_MIN_LEVEL) {
    await client.query('DELETE FROM street_deed_benefit_eligibility WHERE character_id=$1', [ch.id]);
    return;
  }
  await client.query(`INSERT INTO street_deed_benefit_eligibility (character_id,eligible_at)
    VALUES ($1,$2) ON CONFLICT (character_id) DO NOTHING`, [ch.id, new Date(now)]);
}
