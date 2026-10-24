// Canonical proof identity for the paid X-post faucet. Only actual X/Twitter post URLs and bare
// numeric post ids qualify; arbitrary trust-mode text or another site's /status/ path must never
// become a permanent global receipt. URL aliases and leading zeroes collapse to one provider/id.
const X_POST_HOSTS = new Set(['x.com', 'twitter.com', 'mobile.twitter.com']);

const normalizeId = (id) => {
  if (!id) return null;
  const canonicalId = BigInt(id).toString();
  return canonicalId === '0' ? null : { provider: 'x', id: canonicalId };
};

export function normalizeSocialPostProof(proof) {
  const raw = String(proof || '').trim();
  let id = /^\d{8,25}$/.test(raw) ? raw : null;
  if (!id) {
    let parsed;
    try {
      const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw);
      parsed = new URL(hasScheme ? raw : `https://${raw}`);
    } catch { return null; }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!X_POST_HOSTS.has(host)) return null;
    id = parsed.pathname.match(/\/status(?:es)?\/(\d{8,25})(?:\/|$)/i)?.[1] || null;
  }
  return normalizeId(id);
}

// The predecessor accepted any string containing /status(es)/<id>, then fetched that exact id from
// X and author-bound it before paying. Historical evidence must retain those already-paid aliases
// or the same verified post can replay after upgrade. Never use this permissive parser on new input.
export function normalizeLegacyPaidSocialPostProof(proof) {
  const raw = String(proof || '');
  // Keep this byte-for-byte equivalent to the predecessor's extraction rules. A historical proof
  // can look malformed by today's standard and still have fetched and author-verified this X id.
  const pathId = raw.match(/status(?:es)?\/(\d{8,25})/)?.[1];
  const bareId = raw.match(/^(\d{8,25})$/)?.[1];
  return normalizeId(pathId || bareId);
}
