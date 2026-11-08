import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from '../src/server.js';

if (process.env.DATABASE_URL) throw new Error('Agent onboarding requires a disposable database.');
process.env.RATE_LIMIT = 'off';
const app = await buildServer();
const secret = () => crypto.randomBytes(32).toString('base64url');
const call = (url, payload, headers = {}) => app.inject({ method: 'POST', url, payload, headers });
const count = async () => Number((await app.pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n);
try {
  const before = await count();
  for (const url of ['/v1/auth/guest', '/v1/access/redeem', '/v1/auth/x', '/v1/auth/privy', '/v1/auth/x/start']) {
    const response = await call(url, { bootstrapSecret: secret(), agent: true, token: 'not-a-provider-token' });
    assert.equal(response.json().error, 'age_required', `${url} cannot opt out through an agent body flag`);
  }
  assert.equal(await count(), before);
  for (const bootstrapSecret of [undefined, 'short', 'A'.repeat(42) + 'B']) {
    const response = await call('/v1/auth/agent', { bootstrapSecret });
    assert.equal(response.json().error, 'bootstrap_credential');
  }
  assert.equal(await count(), before, 'invalid agent recovery credentials create no account');

  const bootstrapSecret = secret();
  const attempts = await Promise.all(Array.from({ length: 3 }, () => call('/v1/auth/agent', { bootstrapSecret, agent: false })));
  for (const response of attempts) assert.equal(response.statusCode, 200, response.body);
  const claims = attempts.map(response => app.jwt.verify(response.json().token));
  assert.equal(new Set(claims.map(c => c.sub)).size, 1, 'ambiguous concurrent signup retries recover the same identity');
  assert.equal(await count(), before + 1);
  const accountId = claims[0].sub;
  assert.equal(claims[0].agent, true);
  assert.equal(claims[0].exp - claims[0].iat, 90 * 86400);
  const persistent = (await app.pool.query('SELECT * FROM account_persistent WHERE account_id=$1', [accountId])).rows[0];
  assert.equal(persistent.agent_flag, true, 'agent classification exists before the first bearer is used');
  const token = attempts[0].json().token;
  const headers = { authorization: `Bearer ${token}` };
  const session = await app.inject({ url: '/v1/session', headers });
  assert.equal(session.json().agent, true);
  const rawAccount = (await app.pool.query('SELECT * FROM accounts WHERE id=$1', [accountId])).rows[0];
  assert.equal(Object.keys({ ...rawAccount, ...persistent, ...claims[0] }).some(key => /birth|dob/i.test(key)), false);

  const humanRoute = await call('/v1/auth/guest', { bootstrapSecret });
  assert.equal(humanRoute.json().error, 'age_required', 'agent recovery proof does not admit a human account');
  assert.equal(await count(), before + 1);
  await call('/v1/auth/guest/bootstrap/ack', {}, headers);
  const retired = await call('/v1/auth/agent', { bootstrapSecret });
  assert.equal(retired.json().error, 'bootstrap_retired', 'durably saved bearer retires bootstrap recovery');
  assert.equal(await count(), before + 1);

  const character = await call('/v1/character', { name: 'DOB Free Agent' }, headers);
  assert.equal(character.statusCode, 200, character.body);
  const turn = await app.inject({ url: '/v1/agent/turn', headers });
  assert.equal(turn.statusCode, 200, turn.body);
  assert.ok(turn.json().turnId);
  assert.ok(turn.json().actions.length);
  const previousSocialMode = process.env.SOCIAL_VERIFY_MODE;
  try {
    process.env.SOCIAL_VERIFY_MODE = 'trust';
    const social = await call('/v1/social/share/claim', {}, headers);
    assert.equal(social.json().error, 'agent', 'the exempt identity cannot claim human-only social cash');
  } finally {
    if (previousSocialMode === undefined) delete process.env.SOCIAL_VERIFY_MODE;
    else process.env.SOCIAL_VERIFY_MODE = previousSocialMode;
  }

  const denied = await call('/v1/age-check', { birthDate: '2020-01-01' });
  const cookie = denied.headers['set-cookie'].split(';')[0];
  const deniedCount = await count();
  for (const payload of [{ bootstrapSecret: secret(), birthDate: '2020-01-01' }, { bootstrapSecret: secret(), birthDate: 'invalid' }]) {
    assert.ok((await call('/v1/auth/agent', payload)).statusCode >= 400);
  }
  const blocked = await call('/v1/auth/agent', { bootstrapSecret: secret() }, { cookie });
  assert.equal(blocked.json().error, 'age_ineligible', 'an agent declaration cannot override a known browser denial');
  assert.equal(await count(), deniedCount);

  const unackedSecret = secret();
  const unacked = await call('/v1/auth/agent', { bootstrapSecret: unackedSecret });
  const unackedHeaders = { authorization: `Bearer ${unacked.json().token}` };
  await call('/v1/character', { name: 'Unacked Agent' }, unackedHeaders);
  assert.equal((await call('/v1/auth/agent', { bootstrapSecret: unackedSecret })).json().error, 'bootstrap_retired',
    'character creation closes unacknowledged recovery');
  const spec = (await app.inject('/openapi.json')).json();
  assert.deepEqual(spec.paths['/v1/auth/agent'].post.security, [], 'agent signup is advertised without bearer auth');
  console.log('Agent-only age exemption: permanent classification, recovery, privacy, denial precedence and human-route isolation passed.');
} finally { await app.close(); }
