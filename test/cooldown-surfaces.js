process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'test-street-cooldown-surfaces';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildServer } from './server-fixture.js';
import { SYSTEMS, systemEligibility } from '../src/explore.js';

const crimeSystem = SYSTEMS.find((entry) => entry.eligibility === 'always');
const ctx = { ch: { nerve: 50, cash: 0 }, level: 1, acct: {}, owned: {}, live: {} };
assert.ok(systemEligibility(crimeSystem, ctx).operation);
ctx.ch.street_action_at = new Date(Date.now() + 30000);
assert.equal(systemEligibility(crimeSystem, ctx).operation, null,
  'Explore cannot recommend crime while the shared street clock runs');
ctx.ch.street_action_at = new Date(Date.now() - 1);
assert.ok(systemEligibility(crimeSystem, ctx).operation);

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
for (const token of [
  'observeStreetActionClock();', 'const streetActionLeft =', 'const streetActionOff =',
  'const streetActionClock =', '${streetActionClock()}', '${streetActionOff()}',
  'streetActionLeft() > 0 ? `The street is cooling down',
]) assert.ok(html.includes(token), `client cooldown surface missing ${token}`);
assert.ok(html.indexOf('observeStreetActionClock();') > html.indexOf('me = result.body.player?.character'),
  'a fresh player projection observes the server clock');

if (process.env.DATABASE_URL) throw new Error('Cooldown surfaces requires disposable pg-mem; clear DATABASE_URL.');
const app = await buildServer();
const call = async (method, url, token, payload) => {
  const response = await app.inject({ method, url, payload,
    headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal(response.statusCode, 200, `${method} ${url}: ${response.body}`);
  return response.json();
};
try {
  const guest = (await call('POST', '/v1/auth/guest')).token;
  const token = (await call('POST', '/v1/auth/agent-key', guest)).token;
  await call('POST', '/v1/character', token, { name: 'Paced Surfaces' });
  const before = await call('GET', '/v1/agent/turn', token);
  const id = before.state.identity.id;
  assert.ok(before.actions.some((action) => action.kind === 'crime'));
  const until = new Date(Date.now() + 30000);
  await app.pool.query('UPDATE characters SET cash=0,nerve=50,street_action_at=$1,last_accrued_at=now() WHERE id=$2', [until, id]);
  const cooling = await call('GET', '/v1/agent/turn', token);
  assert.equal(cooling.actions.some((action) => action.kind === 'crime'), false);
  const blocked = cooling.blockedActions.find((action) => action.kind === 'crime');
  assert.ok(blocked?.blockedBy.some((item) => item.code === 'street_cooldown'
    && new Date(item.availableAt).getTime() === until.getTime()));
  assert.equal(new Date(cooling.nextWakeAt).getTime(), until.getTime());
  await app.pool.query('UPDATE characters SET street_action_at=$1 WHERE id=$2', [new Date(Date.now() - 1), id]);
  const ready = await call('GET', '/v1/agent/turn', token);
  assert.ok(ready.actions.some((action) => action.kind === 'crime'));
} finally {
  await app.close();
}

console.log('Shared street cooldown projections and controls passed.');
