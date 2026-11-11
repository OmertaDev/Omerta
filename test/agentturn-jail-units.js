import assert from 'node:assert/strict';
import { buildServer } from './server-fixture.js';
import { cityEventOf, dayOf } from '../src/rules.js';

if (process.env.DATABASE_URL) throw new Error('Jail-unit regression requires a disposable memory database.');
process.env.NODE_ENV = 'test'; process.env.RATE_LIMIT = 'off';
process.env.SEASON_MOD = 'dead_quiet'; process.env.SEASON_PHASE = 'long_game';
const app = await buildServer();
let token;
const call = async (method, url, payload) => {
  const response = await app.inject({ method, url, payload,
    headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
};
const failCrimeAt = async (at) => {
  const random = Math.random, now = Date.now;
  try {
    Date.now = () => at;
    const turn = await call('GET', '/v1/agent/turn');
    const action = turn.actions.find(action => action.path === '/v1/crimes/stereo');
    assert(action?.executable, 'the fresh character can take the published standard job');
    Math.random = () => 0.999999;
    return { action, result: await call('POST', action.path, action.body) };
  } finally { Math.random = random; Date.now = now; }
};
try {
  token = (await call('POST', '/v1/auth/guest')).token;
  token = (await call('POST', '/v1/auth/agent-key', {})).token;
  await call('POST', '/v1/character', { name: 'Jail Units Regression' });
  // Daily city events are independent of the season overrides above. Pin the turn and action,
  // not the whole server lifecycle, so midnight cannot turn this baseline into HEAT WAVE.
  const neutralAt = Date.parse('2026-11-10T12:00:00Z');
  const neutralEvent = cityEventOf(dayOf(neutralAt));
  assert.equal(neutralEvent.id, 'opencity', 'the explicit baseline date selects OPEN CITY');
  assert.equal(neutralEvent.jailMult ?? 1, 1, 'the baseline has no city-event jail modifier');
  const { action, result } = await failCrimeAt(neutralAt);
  assert.equal(result.success, false, 'the pinned failed roll exercises the authoritative jail outcome');
  assert.equal(result.jailSeconds, 8, 'canonical gameplay duration remains eight seconds');
  assert.equal(action.risk.baseJailSeconds, result.jailSeconds,
    'the descriptor agrees with actual standard jail time when no character or season modifier applies');
  assert.equal(action.risk.jailMinutes * 60, action.risk.baseJailSeconds,
    'legacy minute consumers receive the same duration in their documented unit');
  console.log('agentturn jail units: baseJailSeconds=8, legacy jailMinutes=8/60, authoritative failed crime jailSeconds=8 passed');

  // These literal outcomes catch a dropped/doubled event multiplier or a descriptor
  // accidentally reporting the modified outcome instead of the base duration.
  for (const [eventId, date, multiplier, seconds] of [
    ['heat', '2026-11-11T12:00:00Z', 2, 16],
    ['visit', '2026-11-16T12:00:00Z', 0.5, 4],
    ['crackdown', '2026-11-22T12:00:00Z', 1.5, 12],
  ]) {
    const at = Date.parse(date), event = cityEventOf(dayOf(at));
    assert.equal(event.id, eventId, 'the explicit date selects the intended daily city event');
    assert.equal(event.jailMult, multiplier, 'the fixture exercises the documented jail modifier');
    token = (await call('POST', '/v1/auth/guest')).token;
    token = (await call('POST', '/v1/auth/agent-key', {})).token;
    await call('POST', '/v1/character', { name: `Jail Units ${eventId}` });
    const { action: eventAction, result: outcome } = await failCrimeAt(at);
    assert.equal(outcome.success, false, `${eventId}: the pinned roll fails the real crime`);
    assert.equal(outcome.jailSeconds, seconds, `${eventId}: the authoritative outcome applies the daily modifier once`);
    assert.equal(eventAction.risk.baseJailSeconds, 8, `${eventId}: the descriptor retains the unmodified base duration`);
    assert.equal(eventAction.risk.jailMinutes * 60, eventAction.risk.baseJailSeconds,
      `${eventId}: the legacy minute field retains the base duration in its documented unit`);
  }
  console.log('agentturn jail event controls: heat=16, visit=4, crackdown=12; base descriptor unchanged passed');
} finally { await app.close(); }
