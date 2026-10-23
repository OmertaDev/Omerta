import { cityEventOf, dayOf, M3, bustAttemptsLeft, jailed, hospitalized, safeHoused } from './rules.js';

export function rescueQuote(actor, target, now = Date.now()) {
  const remaining = target.alive === false ? 0 : Math.max(0, (new Date(target.jail_until || 0).getTime() - now) / 1000);
  const blockers = [];
  if (jailed(actor, now)) blockers.push('jailed');
  if (hospitalized(actor, now)) blockers.push('hospitalized');
  if (safeHoused(actor, now)) blockers.push('safehouse');
  if (bustAttemptsLeft(actor) === 0) blockers.push('attempts');
  if (remaining <= 0) blockers.push('free');
  return {
    jailed: remaining > 0, remainingSeconds: Math.ceil(remaining),
    canAttempt: blockers.length === 0, blockers,
    chance: remaining > 0 ? Math.max(.10, Math.min(.90, .7 - remaining / 400 + (Number(actor.busts) || 0) * .03 + (cityEventOf(dayOf()).bustAdd || 0))) : 0,
    reward: remaining > 0 ? Math.floor(500 + remaining * 15) : 0,
    failureJailSeconds: M3.BUST_FAIL_JAIL_S,
  };
}
