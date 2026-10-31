import assert from 'node:assert/strict';
import { MINIMUM_AGE, eligibleBirthDate } from '../src/age.js';
import { buildServer } from '../src/server.js';

const now = new Date('2026-10-31T12:00:00Z');
assert.equal(MINIMUM_AGE, 21);
assert.equal(eligibleBirthDate('2005-10-31', now), true);
assert.equal(eligibleBirthDate('2005-11-01', now), false);
assert.throws(() => eligibleBirthDate('2005-02-30', now));
assert.equal(eligibleBirthDate('2006-01-01', now), false, 'a 20-year-old is ineligible');
assert.equal(eligibleBirthDate('2007-03-01', new Date('2028-02-29T12:00:00Z')), false, 'leap day does not admit a birthday early');
assert.equal(eligibleBirthDate('2004-02-29', new Date('2025-02-28T12:00:00Z')), false);
assert.equal(eligibleBirthDate('2004-02-29', new Date('2025-03-01T12:00:00Z')), true);
assert.throws(() => eligibleBirthDate('2027-01-01', now));
const app = await buildServer();
try {
  const count = async () => Number((await app.pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n);
  const before = await count();
  for (const birthDate of [undefined, '2020-01-01', '2007-01-01']) {
    const response = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: birthDate ? { birthDate } : {} });
    assert.ok(response.statusCode >= 400);
  }
  let fetched = false;
  const oldFetch = global.fetch;
  global.fetch = async () => { fetched = true; throw new Error('must not reach provider'); };
  try {
    const response = await app.inject({ method: 'POST', url: '/v1/auth/privy', payload: { token: 'hostile', birthDate: '2020-01-01' } });
    assert.equal(response.json().error, 'age_ineligible');
    assert.equal(fetched, false);
  } finally { global.fetch = oldFetch; }
  assert.equal(await count(), before, 'denied ages create no account or account IP');
  const denied = await app.inject({ method: 'POST', url: '/v1/age-check', payload: { birthDate: '2020-01-01' } });
  assert.equal(denied.statusCode, 403);
  const blockedCookie = denied.headers['set-cookie'].split(';')[0];
  const retry = await app.inject({ method: 'POST', url: '/v1/age-check', headers: { cookie: blockedCookie }, payload: { birthDate: '1990-01-01' } });
  assert.equal(retry.statusCode, 403, 'denial cannot be corrected immediately using the same browser cookie');
  const approved = await app.inject({ method: 'POST', url: '/v1/age-check', payload: { birthDate: '1990-01-01' } });
  assert.equal(approved.statusCode, 200);
  const token = approved.headers['set-cookie'].split(';')[0].slice('omerta_age='.length);
  assert.equal(app.jwt.verify(token).purpose, 'age-check');
  assert.equal(app.jwt.verify(token).minimumAge, 21);
  for (const claim of [{ purpose: 'age-check', eligible: true }, { purpose: 'age-check', eligible: true, minimumAge: 13 }]) {
    const old = app.jwt.sign(claim, { expiresIn: '15m' });
    const denied = await app.inject({ method: 'POST', url: '/v1/auth/guest', headers: { cookie: 'omerta_age=' + old }, payload: {} });
    assert.equal(denied.json().error, 'age_required', 'a proof from the earlier policy cannot authorize new signup');
  }
  assert.equal(JSON.stringify(app.jwt.verify(token)).includes('1990'), false);
  const explicitChild = await app.inject({ method: 'POST', url: '/v1/auth/guest',
    headers: { cookie: approved.headers['set-cookie'].split(';')[0] }, payload: { birthDate: '2020-01-01' } });
  assert.equal(explicitChild.json().error, 'age_ineligible', 'earlier eligibility cannot override an explicit child birth date');
  assert.equal(await count(), before);
  const created = await app.inject({ method: 'POST', url: '/v1/auth/guest', headers: { cookie: approved.headers['set-cookie'].split(';')[0] }, payload: {} });
  assert.equal(created.statusCode, 200, 'eligible cookie admits account creation');
  const secret = Buffer.alloc(32, 7).toString('base64url');
  const first = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { bootstrapSecret: secret, birthDate: '1990-01-01' } });
  assert.equal(first.statusCode, 200);
  const recovered = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { bootstrapSecret: secret } });
  assert.equal(recovered.statusCode, 200, 'existing bootstrap recovery does not require birth date again');
  assert.equal(app.jwt.verify(first.json().token).sub, app.jwt.verify(recovered.json().token).sub);
  const blockedRecovery = await app.inject({ method: 'POST', url: '/v1/auth/guest',
    headers: { cookie: blockedCookie }, payload: { bootstrapSecret: secret } });
  assert.equal(blockedRecovery.json().error, 'age_ineligible', 'recovery does not bypass known-ineligible browser status');
  const ageBearer = await app.inject({ url: '/v1/session', headers: { authorization: `Bearer ${token}` } });
  assert.ok(ageBearer.statusCode >= 400, 'age eligibility token cannot authorize a player session');
  console.log('Age gate: boundary, invalid dates, creation rejection, provider isolation, cookie denial and DOB minimization passed.');
} finally { await app.close(); }
