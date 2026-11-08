import assert from 'node:assert/strict';
import { buildServer } from './server-fixture.js';

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
try {
  token = (await call('POST', '/v1/auth/guest')).token;
  token = (await call('POST', '/v1/auth/agent-key', {})).token;
  await call('POST', '/v1/character', { name: 'Jail Units Regression' });
  const turn = await call('GET', '/v1/agent/turn');
  const action = turn.actions.find(action => action.path === '/v1/crimes/stereo');
  assert(action?.executable, 'the fresh character can take the published standard job');
  const random = Math.random;
  let result;
  try {
    Math.random = () => 0.999999;
    result = await call('POST', action.path, action.body);
  } finally { Math.random = random; }
  assert.equal(result.success, false, 'the pinned failed roll exercises the authoritative jail outcome');
  assert.equal(result.jailSeconds, 8, 'canonical gameplay duration remains eight seconds');
  assert.equal(action.risk.baseJailSeconds, result.jailSeconds,
    'the descriptor agrees with actual standard jail time when no character or season modifier applies');
  assert.equal(action.risk.jailMinutes * 60, action.risk.baseJailSeconds,
    'legacy minute consumers receive the same duration in their documented unit');
  console.log('agentturn jail units: baseJailSeconds=8, legacy jailMinutes=8/60, authoritative failed crime jailSeconds=8 passed');
} finally { await app.close(); }
