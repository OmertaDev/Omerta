import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  canonicalClientIp, CLIENT_IP_AUTHORITY, clientIpContextForRequest,
} from '../src/client-ip.js';

delete process.env.DATABASE_URL;
Object.assign(process.env, {
  NODE_ENV: 'test', RATE_LIMIT: 'off', INVITE_MODE: 'off', SOCIAL_VERIFY_MODE: 'off',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'),
});

assert.equal(canonicalClientIp(' 203.0.113.9 '), '203.0.113.9');
assert.equal(canonicalClientIp('2001:0DB8:0:0:0:0:0:1'), '2001:db8::1');
assert.equal(canonicalClientIp('::ffff:203.0.113.9'), '203.0.113.9');
assert.equal(canonicalClientIp('0:0:0:0:0:ffff:cb00:7109'), '203.0.113.9');
for (const invalid of ['', 'unknown', '203.0.113.9:443', '203.0.113.9, 198.51.100.2'])
  assert.equal(canonicalClientIp(invalid), null);

assert.deepEqual(clientIpContextForRequest(
  { ip: '10.20.30.40', headers: { 'cf-connecting-ip': '203.0.113.7' } },
  { isRender: true, trustRenderProxy: false },
), { ip: '10.20.30.40', authority: null },
'a Render socket never becomes durable caller identity when protected-header trust is off');
assert.deepEqual(clientIpContextForRequest(
  { ip: '198.51.100.55', headers: { 'cf-connecting-ip': '203.0.113.7' } },
  { isRender: false, trustRenderProxy: false },
), { ip: '198.51.100.55', authority: CLIENT_IP_AUTHORITY.direct },
'a direct self-hosted socket remains authoritative');
assert.deepEqual(clientIpContextForRequest(
  { ip: '198.51.100.55', headers: { 'cf-connecting-ip': '203.0.113.7' } },
  { isRender: false, trustRenderProxy: true },
), { ip: '198.51.100.55', authority: CLIENT_IP_AUTHORITY.direct },
'Render header mode is inert outside Render even before preflight rejects that configuration');

const { buildServer } = await import('../src/server.js');
const createGuest = async (app, { remoteAddress, forwardedFor, connectingIp }) => {
  const headers = {};
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  if (connectingIp) headers['cf-connecting-ip'] = connectingIp;
  const response = await app.inject({
    method: 'POST', url: '/v1/auth/guest', remoteAddress,
    headers,
    payload: { birthDate: '1990-01-01' },
  });
  assert.equal(response.statusCode, 200, response.body);
  const accountId = app.jwt.decode(response.json().token).sub;
  return (await app.pool.query(
    'SELECT created_ip, last_ip, created_ip_authority FROM accounts WHERE id=$1', [accountId],
  )).rows[0];
};

process.env.TRUST_PROXY = 'on';
process.env.RENDER = 'true';
const trusted = await buildServer();
try {
  trusted.get('/__test/client-ip', async (request) => ({
    socketIp: request.ip, clientIp: request.clientIp, authority: request.clientIpAuthority,
  }));
  const probe = (await trusted.inject({
    url: '/__test/client-ip', remoteAddress: '10.20.30.40',
    headers: { 'x-forwarded-for': '192.0.2.250, 198.51.100.22', 'cf-connecting-ip': '203.0.113.7' },
  })).json();
  assert.deepEqual(probe, {
    socketIp: '10.20.30.40', clientIp: '203.0.113.7',
    authority: CLIENT_IP_AUTHORITY.render,
  },
    'Fastify retains the raw socket IP while the narrow resolver reads Render protected provenance');

  const first = await createGuest(trusted, {
    remoteAddress: '10.20.30.40',
    forwardedFor: '192.0.2.250, 198.51.100.22',
    connectingIp: '203.0.113.7',
  });
  assert.deepEqual(first, {
    created_ip: '203.0.113.7', last_ip: '203.0.113.7',
    created_ip_authority: CLIENT_IP_AUTHORITY.render,
  },
    'Render mode uses protected CF-Connecting-IP, ignoring attacker-controlled X-Forwarded-For');

  const mapped = await createGuest(trusted, {
    remoteAddress: '10.20.30.40',
    forwardedFor: '192.0.2.251',
    connectingIp: '::FFFF:CB00:7109',
  });
  assert.deepEqual(mapped, {
    created_ip: '203.0.113.9', last_ip: '203.0.113.9',
    created_ip_authority: CLIENT_IP_AUTHORITY.render,
  },
    'IPv4-mapped forwarding addresses share the canonical IPv4 identity');

  const invalid = await createGuest(trusted, {
    remoteAddress: '::ffff:198.51.100.44',
    forwardedFor: 'not-an-ip, 203.0.113.10',
    connectingIp: 'not-an-ip',
  });
  assert.deepEqual(invalid, {
    created_ip: '198.51.100.44', last_ip: '198.51.100.44', created_ip_authority: null,
  }, 'Render fallback remains usable for throttling but has no durable origin authority');

  const bootstrapSecret = crypto.randomBytes(32).toString('base64url');
  const redeem = async (connectingIp, birthDate) => trusted.inject({
    method: 'POST', url: '/v1/access/redeem', remoteAddress: '10.20.30.40',
    headers: { 'cf-connecting-ip': connectingIp },
    payload: { bootstrapSecret, ...(birthDate ? { birthDate } : {}) },
  });
  const admitted = await redeem('203.0.113.80', '1990-01-01');
  assert.equal(admitted.statusCode, 200, admitted.body);
  const bootstrapAccount = trusted.jwt.decode(admitted.json().token).sub;
  const recovered = await redeem('203.0.113.81');
  assert.equal(recovered.statusCode, 200, recovered.body);
  assert.deepEqual((await trusted.pool.query(
    'SELECT created_ip, last_ip, created_ip_authority FROM accounts WHERE id=$1', [bootstrapAccount],
  )).rows[0], {
    created_ip: '203.0.113.80', last_ip: '203.0.113.81',
    created_ip_authority: CLIENT_IP_AUTHORITY.render,
  }, 'bootstrap recovery updates last_ip without rewriting immutable signup provenance');

  const { accountForIdentity } = await import('../src/auth.js');
  const identity = { provider: 'client-ip-test', subject: crypto.randomUUID() };
  const provider = await accountForIdentity(
    trusted.pool, identity, '203.0.113.90', null, CLIENT_IP_AUTHORITY.render,
  );
  await accountForIdentity(trusted.pool, identity, '203.0.113.91', null, CLIENT_IP_AUTHORITY.direct);
  assert.deepEqual((await trusted.pool.query(
    'SELECT created_ip, last_ip, created_ip_authority FROM accounts WHERE id=$1', [provider.accountId],
  )).rows[0], {
    created_ip: '203.0.113.90', last_ip: '203.0.113.91',
    created_ip_authority: CLIENT_IP_AUTHORITY.render,
  }, 'provider sign-in also stores authority only on the initial account insert');
} finally {
  await trusted.close();
}

process.env.TRUST_PROXY = 'off';
delete process.env.RENDER;
const direct = await buildServer();
try {
  const row = await createGuest(direct, {
    remoteAddress: '198.51.100.55',
    forwardedFor: '203.0.113.55',
    connectingIp: '203.0.113.56',
  });
  assert.deepEqual(row, {
    created_ip: '198.51.100.55', last_ip: '198.51.100.55',
    created_ip_authority: CLIENT_IP_AUTHORITY.direct,
  },
    'without Render trust, caller-controlled forwarding headers are ignored');
} finally {
  await direct.close();
}

console.log('client-ip: PASS — Render forwarding is narrow, validated and canonical');
