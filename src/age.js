// Birth dates are checked in memory and never persisted or included in tokens.
import { GameError } from './game.js';

export function eligibleBirthDate(value, now = new Date()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new GameError('birth_date', 'Enter a valid complete birth date.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value ||
      date > now || date.getUTCFullYear() < now.getUTCFullYear() - 120)
    throw new GameError('birth_date', 'Enter a valid complete birth date.');
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 13, now.getUTCMonth(), now.getUTCDate()));
  return date <= cutoff;
}

export function ageCookie(token = '', maxAge = 900) {
  return `omerta_age=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function ageStatus(app, req) {
  const value = (req.headers.cookie || '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith('omerta_age='))?.slice(11);
  try {
    const claims = app.jwt.verify(value);
    return claims.purpose === 'age-check' ? claims.eligible : null;
  } catch { return null; }
}

export function requireAge(app, req) {
  const status = ageStatus(app, req);
  if (status === false) throw new GameError('age_ineligible', 'Account creation is unavailable. See /privacy for help.');
  if (req.body?.birthDate !== undefined) {
    if (eligibleBirthDate(req.body.birthDate)) return;
    throw new GameError('age_ineligible', 'Account creation is unavailable. See /privacy for help.');
  }
  if (status === true) return;
  throw new GameError('age_required', 'Complete the birth date check before creating an account.');
}
