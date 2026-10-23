import { isIP } from 'node:net';

// Return one stable spelling for address equality and rate-limit keys. PostgreSQL stores these
// values as text, so equivalent IPv6 spellings must not become distinct identities. IPv4-mapped
// IPv6 is collapsed to IPv4 because Node commonly exposes IPv4 sockets in that form.
export function normalizeClientIp(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  const version = isIP(input);
  if (version === 4) return input.split('.').map((part) => String(Number(part))).join('.');
  if (version !== 6 || input.includes('%')) return null;

  let canonical;
  try {
    const hostname = new URL(`http://[${input}]/`).hostname;
    canonical = hostname.slice(1, -1);
  } catch {
    return null;
  }
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
  if (!mapped) return canonical;
  const high = Number.parseInt(mapped[1], 16), low = Number.parseInt(mapped[2], 16);
  return `${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`;
}

export const canonicalClientIp = normalizeClientIp;

export const CLIENT_IP_AUTHORITY = Object.freeze({
  render: 'render_cf_connecting_ip_v1',
  direct: 'direct_socket_v1',
});

export function normalizeClientIpAuthority(value) {
  return Object.values(CLIENT_IP_AUTHORITY).includes(value) ? value : null;
}

export function clientIpContextForRequest(request, {
  trustRenderProxy = false,
  isRender = false,
} = {}) {
  const socketIp = normalizeClientIp(request.ip);
  if (!(trustRenderProxy && isRender)) return {
    ip: socketIp || '0.0.0.0',
    // A Render socket belongs to the shared platform proxy, not to the caller. A missing/off
    // proxy setting must therefore remain untrusted even though the socket address is valid.
    authority: socketIp && !isRender ? CLIENT_IP_AUTHORITY.direct : null,
  };

  // Render's Cloudflare edge overwrites CF-Connecting-IP, while X-Forwarded-For is appended to
  // and can retain a caller-supplied leftmost value. Accept the protected header only as a scalar.
  const header = request.headers?.['cf-connecting-ip'];
  const protectedIp = typeof header === 'string' ? normalizeClientIp(header) : null;
  if (protectedIp) return { ip: protectedIp, authority: CLIENT_IP_AUTHORITY.render };

  // The socket still gives rate limits a fail-closed shared proxy bucket, but it is not durable
  // signup provenance and therefore receives no authority for same-origin economy decisions.
  return { ip: socketIp || '0.0.0.0', authority: null };
}

export function clientIpForRequest(request, {
  trustRenderProxy = false,
  isRender = false,
} = {}) {
  return clientIpContextForRequest(request, { trustRenderProxy, isRender }).ip;
}
