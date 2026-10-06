// Launch admission, repeat-safe recovery, view-only cookies, and durable player invite allowances.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { buildServer } from '../src/server.js';
import { inviteModeEnabled, normalizeInviteCode } from '../src/invites.js';
import { accessCookie, readAccessCookie } from '../src/access.js';
import { makeInviteBatch, validateBatch, importBatch } from '../tools/invites.js';

assert.equal(inviteModeEnabled({ NODE_ENV: 'production' }), false);
assert.equal(inviteModeEnabled({ DATABASE_URL: 'postgres://test' }), false);
assert.equal(inviteModeEnabled({ INVITE_MODE: 'typo' }), false);
assert.equal(inviteModeEnabled({ INVITE_MODE: 'off', NODE_ENV: 'production' }), false);
assert.equal(inviteModeEnabled({}), false);
const batch = validateBatch(makeInviteBatch(5000));
assert.equal(new Set(batch.codes).size, 5000);
assert.equal(normalizeInviteCode(' ' + batch.codes[0].toLowerCase() + ' '), batch.codes[0]);
for (const count of [0, 5001, 1.5, NaN]) assert.throws(() => makeInviteBatch(count));
assert.throws(() => validateBatch({ ...batch, codes: batch.codes.map(() => batch.codes[0]) }));

process.env.INVITE_MODE = 'off';
process.env.RATE_LIMIT = 'off';
const app = await buildServer(), pool = app.pool;
const call = (method, url, body, headers = {}) => app.inject({ method, url, payload: body, headers });
const auth = (token) => ({ authorization: 'Bearer ' + token });
const secret = () => crypto.randomBytes(32).toString('base64url');
const uses = async (code) => Number((await pool.query('SELECT uses_left FROM invite_codes WHERE code=$1', [code])).rows[0].uses_left);
try {
  const existing = (await call('POST', '/v1/auth/guest')).json().token;
  const existingSub = app.jwt.verify(existing).sub;
  const originalConsole = await call('GET', '/');
  process.env.INVITE_MODE = 'on';
  const slice = { ...batch, count: 12, codes: batch.codes.slice(0, 12) };
  assert.equal((await importBatch(pool, slice)).inserted, 12);
  const door = await call('GET', '/?ref=Someone');
  assert.equal(door.statusCode, 200);
  assert(!door.body.includes('id="invite-form"'));
  assert(door.body.includes('id="screen-main"'));
  for (const url of ['/v1/city', '/v1/arena', '/v1/market', '/v1/gangs', '/v1/online', '/v1/events', '/v1/rules', '/v1/catalog', '/path', '/play', '/openapi.json']) {
    assert.equal((await call('GET', url)).statusCode, 200, 'public surface: ' + url);
  }
  assert.equal((await call('POST', '/v1/auth/guest')).statusCode, 200);
  assert.equal((await call('POST', '/v1/access/redeem', { inviteCode: slice.codes[0] })).json().error, 'bootstrap_credential');
  assert.equal((await call('POST', '/v1/access/redeem', { bootstrapSecret: secret() })).statusCode, 200, 'recovery signup needs no code');
  const operation = { inviteCode: ' ' + slice.codes[0].toLowerCase() + ' ', bootstrapSecret: secret() };
  const admitted = await call('POST', '/v1/access/redeem', operation);
  assert.equal(admitted.statusCode, 200, admitted.body);
  const token = admitted.json().token, sub = app.jwt.verify(token).sub;
  const cookie = admitted.headers['set-cookie'].split(';')[0];
  assert.match(admitted.headers['set-cookie'], /HttpOnly.*SameSite=Lax/);
  assert.equal(await uses(slice.codes[0]), 1);
  const recovered = await call('POST', '/v1/access/redeem', operation);
  assert.equal(app.jwt.verify(recovered.json().token).sub, sub, 'lost-response retry recovers same identity');
  assert.equal((await call('POST', '/v1/auth/guest', { inviteCode: slice.codes[0] })).statusCode, 200);
  assert.equal((await importBatch(pool, slice)).inserted, 0, 're-import is additive');
  assert.equal(await uses(slice.codes[0]), 1, 're-import never replenishes used codes');
  assert.equal((await call('GET', '/', undefined, { cookie })).body, originalConsole.body);
  const city = await call('GET', '/v1/city', undefined, { cookie });
  assert.equal(city.statusCode, 200);

  assert.equal((await call('GET', '/v1/me', undefined, { cookie })).statusCode, 401, 'view cookie grants no gameplay authentication');
  assert.equal((await call('GET', '/v1/me', undefined, auth(cookie.split('=')[1]))).statusCode, 401, 'view cookie is not a bearer JWT');
  assert(!(await call('GET', '/', undefined, { cookie: cookie + 'tampered' })).body.includes('id="invite-form"'));
  assert.equal((await call('POST', '/v1/access/session', {}, auth(existing))).statusCode, 200, 'existing account grandfathered');
  // Force logout-all to commit immediately after auth reads the old version. The returned cookie
  // must retain that old version and be refused, not silently acquire the newly issued authority.
  const query = pool.query.bind(pool);
  let revokedDuringAuth = false;
  pool.query = async (sql, params) => {
    const result = await query(sql, params);
    if (!revokedDuringAuth && sql.startsWith('SELECT a.status, a.token_version') && params?.[0] === existingSub) {
      revokedDuringAuth = true;
      await query('UPDATE accounts SET token_version=1 WHERE id=$1', [existingSub]);
    }
    return result;
  };
  let racedSession;
  try { racedSession = await call('POST', '/v1/access/session', {}, auth(existing)); }
  finally { pool.query = query; }
  assert(revokedDuringAuth);
  const racedCookie = racedSession.headers['set-cookie'].split(';')[0];
  assert.equal(readAccessCookie({ headers: { cookie: racedCookie } }).tv, 0);
  assert(!(await call('GET', '/', undefined, { cookie: racedCookie })).body.includes('id="invite-form"'));
  assert.equal((await call('POST', '/v1/access/session', {})).statusCode, 401);
  const logout = await call('POST', '/v1/access/logout', {});
  assert.match(logout.headers['set-cookie'], /Max-Age=0/);
  await pool.query('UPDATE accounts SET token_version=1 WHERE id=$1', [sub]);
  assert(!(await call('GET', '/', undefined, { cookie })).body.includes('id="invite-form"'));
  assert.equal((await call('POST', '/v1/access/session', {}, auth(token))).statusCode, 401);
  await pool.query("UPDATE accounts SET status='banned' WHERE id=$1", [existingSub]);
  assert.equal((await call('POST', '/v1/access/session', {}, auth(existing))).statusCode, 403);
  assert(!(await call('GET', '/', undefined, { cookie: accessCookie(existingSub, 0).split(';')[0] })).body.includes('id="invite-form"'));
  assert.equal(readAccessCookie({ headers: { cookie: 'omerta_access=forged.payload' } }), null);
  console.log('PASS: public console and boards, open signup, safe recovery, view-only cookies, revocation and bans');

  assert.equal((await call('GET', '/v1/invites', undefined, auth(token))).statusCode, 401, 'revoked tokens remain invalid');
  const publicToken = (await call('POST', '/v1/auth/guest')).json().token;
  assert.equal((await call('POST', '/v1/invites', {}, auth(publicToken))).json().error, 'no_crew');
  process.env.RATE_LIMIT = 'on'; process.env.RATE_AUTH_BURST = '1'; process.env.RATE_AUTH_PER_SEC = '0.001';
  await call('POST', '/v1/access/redeem', { inviteCode: 'wrong', bootstrapSecret: secret() });
  const throttled = await call('POST', '/v1/access/redeem', { inviteCode: 'wrong', bootstrapSecret: secret() });
  assert.equal(throttled.statusCode, 429);
  assert(throttled.headers['retry-after']);
  const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert(!sw.match(/const SHELL = \[[^\]]*'\/'/), 'service worker never precaches private console');
  console.log('PASS: legacy code validation, no-crew authorization, disabled invitation mode, auth throttle');
} finally { await app.close(); }
