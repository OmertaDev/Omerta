// A view-only, signed browser cookie. It is intentionally not a JWT and cannot authorize gameplay.
import crypto from 'node:crypto';

export const ACCESS_COOKIE = 'omerta_access';
const TTL = 30 * 24 * 60 * 60;
const key = () => crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev-secret-change-me')
  .update('omerta-console-access-v1').digest();
const signature = (payload) => crypto.createHmac('sha256', key()).update(payload).digest('base64url');

export function cookieValue(req, name) {
  return String(req.headers.cookie || '').split(';').map((v) => v.trim())
    .find((v) => v.startsWith(name + '='))?.slice(name.length + 1);
}

export function accessCookie(accountId, tokenVersion) {
  const payload = Buffer.from(JSON.stringify({ sub: accountId, tv: Number(tokenVersion),
    exp: Math.floor(Date.now() / 1000) + TTL })).toString('base64url');
  return `${ACCESS_COOKIE}=${payload}.${signature(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL}`
    + (process.env.NODE_ENV === 'production' ? '; Secure' : '');
}

export function clearAccessCookie() {
  return `${ACCESS_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    + (process.env.NODE_ENV === 'production' ? '; Secure' : '');
}

export function readAccessCookie(req) {
  const value = cookieValue(req, ACCESS_COOKIE);
  if (!value || value.length > 1024) return null;
  const [payload, sig, extra] = value.split('.');
  if (!payload || !sig || extra) return null;
  const expected = Buffer.from(signature(payload));
  const received = Buffer.from(sig);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof claims.sub !== 'string' || !Number.isInteger(claims.tv)
      || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) return null;
    return claims;
  } catch { return null; }
}
