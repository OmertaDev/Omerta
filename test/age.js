import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';

if (process.env.DATABASE_URL) throw new Error('Account admission checks require a disposable database.');
const keys = ['PRIVY_APP_ID', 'X_CLIENT_ID', 'PUBLIC_URL', 'X_TRUST_USER_TOKEN'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const oldFetch = global.fetch;
const app = await buildServer();
try {
  const count = async () => Number((await app.pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n);
  const call = (url, payload = {}, headers = {}) => app.inject({ method: 'POST', url, payload, headers });
  const before = await count();
  const guest = await call('/v1/auth/guest');
  assert.equal(guest.statusCode, 200, guest.body);
  assert.equal(guest.headers['set-cookie'], undefined, 'guest signup sets no age cookie');
  assert.equal(await count(), before + 1, 'guest signup needs no birth date');

  const deniedCookie = `omerta_age=${app.jwt.sign({ purpose: 'age-check', minimumAge: 21, eligible: false }, { expiresIn: '15m' })}`;
  const headers = { cookie: deniedCookie };
  const secret = Buffer.alloc(32, 7).toString('base64url');
  const first = await call('/v1/auth/guest', { bootstrapSecret: secret }, headers);
  assert.equal(first.statusCode, 200, 'a legacy denial cookie no longer blocks signup');
  const recovered = await call('/v1/auth/guest', { bootstrapSecret: secret }, headers);
  assert.equal(recovered.statusCode, 200, 'bootstrap recovery needs no age confirmation');
  assert.equal(app.jwt.verify(first.json().token).sub, app.jwt.verify(recovered.json().token).sub);
  const redeemed = await call('/v1/access/redeem', {
    bootstrapSecret: Buffer.alloc(32, 8).toString('base64url'),
  }, headers);
  assert.equal(redeemed.statusCode, 200, redeemed.body);
  assert(redeemed.headers['set-cookie'].startsWith('omerta_access='), 'browser admission still issues its access cookie');

  process.env.PRIVY_APP_ID = 'admission-test-app';
  const privy = await call('/v1/auth/privy', { token: 'malformed' }, headers);
  assert.equal(privy.json().error, 'auth_failed', 'provider verification runs without age confirmation');

  process.env.X_CLIENT_ID = 'admission-test-client';
  process.env.PUBLIC_URL = 'https://omerta.example';
  process.env.X_TRUST_USER_TOKEN = 'on';
  global.fetch = async url => {
    if (String(url) === 'https://api.x.com/2/oauth2/token')
      return { ok: true, status: 200, json: async () => ({ access_token: 'test-provider-token' }) };
    if (String(url) === 'https://api.x.com/2/users/me')
      return { ok: true, status: 200, json: async () => ({ data: { id: 'admission-test-user' } }) };
    throw new Error(`Unexpected provider request: ${url}`);
  };
  const provider = await call('/v1/auth/x', { token: 'test-provider-token' }, headers);
  assert.equal(provider.statusCode, 200, provider.body);
  const oauth = await call('/v1/auth/x/start', {}, headers);
  assert.equal(oauth.statusCode, 200, oauth.body);
  const state = new URL(oauth.json().url).searchParams.get('state');
  const callback = await app.inject({
    url: `/v1/auth/x/callback?code=test-code&state=${encodeURIComponent(state)}`,
    headers: { cookie: `${deniedCookie}; ${oauth.headers['set-cookie'].split(';')[0]}` },
  });
  assert.equal(callback.statusCode, 302, callback.body);
  assert(callback.headers.location.startsWith('/#token='), 'OAuth callback completes without age confirmation');
  const oauthToken = decodeURIComponent(callback.headers.location.slice('/#token='.length));
  assert.equal(app.jwt.verify(oauthToken).sub, app.jwt.verify(provider.json().token).sub);

  assert.equal((await call('/v1/age-check', { birthDate: '1990-01-01' })).statusCode, 404, 'the age-check endpoint is removed');
  const spec = (await app.inject('/openapi.json')).json();
  assert.equal(spec.paths['/v1/age-check'], undefined);
  assert.equal(spec.paths['/v1/access/redeem'].post.requestBody.content['application/json'].schema.properties.birthDate, undefined);
  console.log('Account admission: guest signup, recovery, browser admission, provider login and OAuth work without age verification.');
} finally {
  global.fetch = oldFetch;
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await app.close();
}
