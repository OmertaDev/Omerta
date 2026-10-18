import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';

const config = { INVITE_MODE: 'off', RATE_LIMIT: 'off', X_CLIENT_ID: 'no-age-test-client',
  PUBLIC_URL: 'https://omerta.example', X_TRUST_USER_TOKEN: 'on' };
const previous = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
Object.assign(process.env, config);
const app = await buildServer();
const oldFetch = global.fetch;
try {
  // Old browser eligibility cookies must no longer block sign-in or account recovery.
  const oldCookie = `omerta_age=${app.jwt.sign({ purpose: 'age-check', eligible: false })}`;
  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', headers: { cookie: oldCookie }, payload: {} });
  assert.equal(guest.statusCode, 200, guest.body);
  assert(guest.json().token, 'guest creation needs no personal age information');
  const bootstrapSecret = Buffer.alloc(32, 7).toString('base64url');
  const first = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { bootstrapSecret } });
  const recovered = await app.inject({ method: 'POST', url: '/v1/auth/guest', headers: { cookie: oldCookie }, payload: { bootstrapSecret } });
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(recovered.statusCode, 200, recovered.body);
  assert.equal(app.jwt.verify(first.json().token).sub, app.jwt.verify(recovered.json().token).sub);

  global.fetch = async (url) => {
    if (String(url).includes('/oauth2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'test-x-token' }) };
    assert.equal(String(url), 'https://api.x.com/2/users/me');
    return { ok: true, status: 200, json: async () => ({ data: { id: 'no-age-x-user' } }) };
  };
  const provider = await app.inject({ method: 'POST', url: '/v1/auth/x', payload: { token: 'test-x-token' } });
  assert.equal(provider.statusCode, 200, provider.body);
  const started = await app.inject({ method: 'POST', url: '/v1/auth/x/start', headers: { cookie: oldCookie }, payload: {} });
  assert.equal(started.statusCode, 200, started.body);
  const state = new URL(started.json().url).searchParams.get('state');
  const callback = await app.inject({ url: `/v1/auth/x/callback?code=test-code&state=${state}`,
    headers: { cookie: `omerta_oauth=${state}; ${oldCookie}` } });
  assert.equal(callback.statusCode, 302, callback.body);
  assert.match(callback.headers.location, /^\/#token=/, 'X sign-in completes without an age check');

  const contract = (await app.inject('/openapi.json')).json();
  assert.equal(contract.paths['/v1/age-check'], undefined, 'the API no longer publishes age collection');
  assert(!JSON.stringify(contract).includes('birthDate'), 'signup schemas do not ask agents for birth dates');
  assert.equal((await app.inject({ method: 'POST', url: '/v1/age-check', payload: {} })).statusCode, 404);
  const page = await app.inject('/');
  assert(!page.body.includes('type="date"'), 'signup does not contain a birth-date input');
  assert(!page.body.includes('verifyAge'), 'signup has no age-check prerequisite');
  console.log('PASS: guest creation, recovery, X provider/OAuth sign-in and API discovery need no age or birth date.');
} finally {
  global.fetch = oldFetch;
  await app.close();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
