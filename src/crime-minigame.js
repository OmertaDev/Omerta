import crypto from 'node:crypto';
import { GameError } from './game.js';
import { CRIMES, M3, levelOf, jailed, coolLeft, coolWait } from './rules.js';

const KIND = 'signal-lock';
const TTL_MS = 5 * 60 * 1000;
const MAX_MISTAKES = 3;
const secret = () => process.env.JWT_SECRET || 'dev-secret-change-me';
const sign = (value) => crypto.createHmac('sha256', secret()).update(`crime-minigame:${value}`).digest('base64url');
const approachOf = (approach) => M3.CRIME_APPROACHES[approach]?.id || 'standard';
const streetClock = (ch) => ch.street_action_at ? new Date(ch.street_action_at).toISOString() : null;

function eligible(ch, crimeId) {
  const crime = CRIMES.find((entry) => entry.id === crimeId);
  if (!crime) throw new GameError('bad_crime', 'No such job.');
  if (jailed(ch)) throw new GameError('jailed', 'You are in lockup.');
  if (levelOf(Number(ch.respect)) < crime.lvl) throw new GameError('level', `That job needs level ${crime.lvl}.`);
  if (Number(ch.nerve) < crime.nerve) throw new GameError('nerve', `Takes ${crime.nerve} nerve.`);
  const remaining = coolLeft(ch.street_action_at);
  if (remaining) throw new GameError('cooldown', `Let the street settle. Next job or deal in ${coolWait(remaining)}.`, { cooldownSeconds: remaining });
}

function roundsOf(nonce) {
  const bytes = crypto.createHmac('sha256', secret()).update(`crime-pattern:${nonce}`).digest();
  let index = 0;
  return [3, 4, 5].map((length) => Array.from({ length }, () => bytes[index++] % 4));
}

export function crimeChallenge(ch, crimeId, approach) {
  eligible(ch, crimeId);
  const payload = { version: 1, characterId: ch.id, accountId: ch.account_id, crimeId,
    approach: approachOf(approach), streetClock: streetClock(ch),
    nonce: crypto.randomBytes(16).toString('hex'), expires: Date.now() + TTL_MS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { minigame: { token: `${encoded}.${sign(encoded)}`, kind: KIND,
    rounds: roundsOf(payload.nonce), pads: ['I', 'II', 'III', 'IV'], maxMistakes: MAX_MISTAKES,
    expiresAt: new Date(payload.expires).toISOString() } };
}

// Verify the submitted interaction trace while holding the same character lock
// as settlement. The signed street clock makes all issued challenges stale as
// soon as any crime or deal commits, including losing attempts.
export function verifyCrimeMinigame(ch, crimeId, approach, submission) {
  eligible(ch, crimeId);
  if (!submission) throw new GameError('crime_minigame_required', 'Play the required job minigame before committing this crime.');
  const bad = () => new GameError('bad_crime_minigame', 'Submit a complete, valid job minigame.');
  const stale = () => new GameError('stale_crime_minigame', 'This job minigame expired or belongs to another attempt. Start it again.');
  if (typeof submission !== 'object' || Array.isArray(submission)
    || Object.keys(submission).some((key) => !['token', 'moves'].includes(key))
    || typeof submission.token !== 'string' || submission.token.length > 2048
    || !Array.isArray(submission.moves) || submission.moves.length > 64
    || submission.moves.some((move) => !Number.isInteger(move) || move < 0 || move > 3)) throw bad();
  const parts = submission.token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) throw bad();
  const expected = Buffer.from(sign(parts[0]));
  if (!crypto.timingSafeEqual(expected, Buffer.from(parts[1]))) throw stale();
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); }
  catch { throw bad(); }
  if (payload.version !== 1 || payload.characterId !== ch.id || payload.accountId !== ch.account_id
    || payload.crimeId !== crimeId || payload.approach !== approachOf(approach)
    || payload.streetClock !== streetClock(ch) || !Number.isFinite(payload.expires)
    || payload.expires <= Date.now() || typeof payload.nonce !== 'string') throw stale();
  const rounds = roundsOf(payload.nonce);
  let round = 0, progress = 0, mistakes = 0;
  for (const move of submission.moves) {
    if (round === rounds.length || mistakes === MAX_MISTAKES) throw bad();
    if (move !== rounds[round][progress]) { mistakes++; progress = 0; }
    else if (++progress === rounds[round].length) { round++; progress = 0; }
  }
  const completed = round === rounds.length;
  if (!completed && mistakes !== MAX_MISTAKES) throw bad();
  return { kind: KIND, completed, mistakes, multiplier: completed ? 1 - 0.15 * mistakes : 0 };
}
