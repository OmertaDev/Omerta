import { GameError } from './game.js';
import { PACING, coolLeft, coolWait } from './rules.js';

// Crimes and corner deals share one durable pacing clock. The conditional write is the
// database-side mutex: concurrent requests cannot both consume the same ready window.
export async function consumeStreetActionCooldown(ch, client) {
  const now = new Date(Date.now());
  const remaining = coolLeft(ch.street_action_at, now.getTime());
  if (remaining)
    throw new GameError('cooldown', `Let the street settle. Next job or deal in ${coolWait(remaining)}.`,
      { cooldownSeconds: remaining });
  const readyAt = new Date(now.getTime() + PACING.STREET_ACTION_CD_MS);
  const updated = await client.query(
    `UPDATE characters SET street_action_at=$2 WHERE id=$1
     AND (street_action_at IS NULL OR street_action_at <= $3) RETURNING id`,
    [ch.id, readyAt, now]);
  if (!updated.rowCount)
    throw new GameError('cooldown', 'Another street action just started. Wait before taking another job or deal.',
      { cooldownSeconds: Math.ceil(PACING.STREET_ACTION_CD_MS / 1000) });
  ch.street_action_at = readyAt;
}
