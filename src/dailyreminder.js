import { dayOf } from './rules.js';
import { bus } from './game.js';

export const DAILY_CASH_MESSAGE = 'Daily Cash reminder: tweet about OMERTÀ or invite new players to your crew. Open Start Here to share your referral link, complete the daily tasks, and collect eligible in-game cash rewards.';

// Account/day identity keeps retries and overlapping worker sweeps idempotent,
// even if the account replaces its character or reads the reminder already.
export async function sendDailyCashReminders(pool, now = Date.now()) {
  const payload = { message: DAILY_CASH_MESSAGE, tab: 'start', day: dayOf(now) };
  const result = await pool.query(`
    INSERT INTO notifications (id, character_id, type, payload)
    SELECT 'daily-cash:' || c.account_id || ':' || $1, c.id, 'daily_cash_reminder', $2
    FROM characters c JOIN accounts a ON a.id=c.account_id
    LEFT JOIN notifications n ON n.id='daily-cash:' || c.account_id || ':' || $1
    WHERE c.alive=true AND c.is_npc=false AND a.status <> 'banned' AND n.id IS NULL
    ON CONFLICT (id) DO NOTHING
    RETURNING character_id`, [String(payload.day), JSON.stringify(payload)]);
  for (const row of result.rows) {
    bus.emit(`me:${row.character_id}`, { type: 'daily_cash_reminder', payload });
  }
  return { sent: result.rowCount };
}
