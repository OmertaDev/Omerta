// §4 — real auth providers alongside guest. Each verifier resolves a provider
// token to a stable (auth_provider, auth_subject) pair; account rows are
// created-or-fetched on that pair, and a guest account can upgrade in place
// (preserving every possession, since everything hangs off the account row).
import crypto from 'node:crypto';
import { GameError } from './game.js';

// X (Twitter): the client sends the user's OAuth2 access token; we resolve it
// via /2/users/me. SECURITY — an X OAuth2 *access token* carries no app-audience
// we can verify (unlike a Privy JWT with its `aud`), so trusting one a user
// pasted lets ANY app the victim ever authorized mint a session for their
// OMERTA account (a confused-deputy account-takeover). The correct production
// path is a server-side authorization-code + PKCE exchange (the token is then
// app-bound by construction) — deploy-time work. Until that's wired, this
// bearer-probe stopgap is OFF by default and only usable when an operator
// explicitly accepts the risk for a closed alpha (`X_TRUST_USER_TOKEN=on` — the
// SOCIAL_VERIFY_MODE / INVITE_MODE default-safe posture). A misconfigured or
// default production therefore never silently accepts an unbound X token.
// every outbound X call is TIME-BOXED (the verify.js posture): a hung X API must never hang an
// auth request; transient trouble (timeout/network/429/5xx) is a clean retryable 'x_busy'.
const AUTH_TIMEOUT_MS = 10000;
async function xApiFetch(url, opts = {}) {
  let res;
  try {
    res = await fetch(url, { ...opts, signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) });
  } catch {
    throw new GameError('x_busy', 'X is not answering right now — try again in a minute.');
  }
  if (res.status === 429 || res.status >= 500)
    throw new GameError('x_busy', 'X is busy right now — try again in a few minutes.');
  return res;
}

export async function verifyX(accessToken) {
  if (!accessToken) throw new GameError('token', 'Missing X access token.');
  if ((process.env.X_TRUST_USER_TOKEN || 'off') !== 'on')
    throw new GameError('provider_unavailable', 'X sign-in is not enabled on this server.');
  const res = await xApiFetch('https://api.x.com/2/users/me', {
    headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new GameError('auth_failed', 'X rejected that token.');
  const data = await res.json();
  if (!data?.data?.id) throw new GameError('auth_failed', 'X returned no identity.');
  return { provider: 'x', subject: String(data.data.id) };
}

// Privy: access tokens are ES256 JWTs signed by the app's key; verify against
// the app's JWKS (fetched once and cached). Requires PRIVY_APP_ID.
let privyJwks = null;
async function fetchJwks(appId) {
  const res = await fetch(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`);
  if (!res.ok) throw new GameError('provider_unavailable', 'Privy JWKS unavailable.');
  return res.json();
}
export async function verifyPrivy(token) {
  const appId = process.env.PRIVY_APP_ID;
  if (!appId) throw new GameError('provider_unavailable', 'Privy sign-in is not configured on this server.');
  if (!token) throw new GameError('token', 'Missing Privy token.');
  const [h, p, sig] = String(token).split('.');
  if (!h || !p || !sig) throw new GameError('auth_failed', 'Malformed Privy token.');
  // (red-team R12 LOW-2) a non-base64url / non-JSON segment threw a raw SyntaxError → 500 for hostile
  // input (the SIWE path already returns a clean 400 for a malformed sig). Decode defensively → clean 400.
  const dec = (seg) => { try { return JSON.parse(Buffer.from(seg, 'base64url').toString()); } catch { throw new GameError('auth_failed', 'Malformed Privy token.'); } };
  const header = dec(h);
  // pin the algorithm: only ES256 is accepted (defense-in-depth against alg confusion)
  if (header.alg !== 'ES256') throw new GameError('auth_failed', 'Unexpected Privy token algorithm.');
  const findKey = async () => {
    if (!privyJwks) privyJwks = await fetchJwks(appId);
    let jwk = (privyJwks.keys || []).find((k) => k.kid === header.kid);
    if (!jwk) { privyJwks = await fetchJwks(appId); jwk = (privyJwks.keys || []).find((k) => k.kid === header.kid); } // refresh on rotation
    return jwk;
  };
  const jwk = await findKey();
  if (!jwk) throw new GameError('auth_failed', 'No matching Privy signing key.'); // no blind keys[0] fallback
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const okSig = crypto.verify('sha256', Buffer.from(`${h}.${p}`),
    { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
  if (!okSig) throw new GameError('auth_failed', 'Privy signature check failed.');
  const claims = dec(p);
  // `aud` may be a scalar or an array (OIDC allows both; some Privy app configs emit `[appId]`) — accept
  // either as long as our appId is present. Still fail-closed: an absent/mismatched audience is rejected.
  const audOk = Array.isArray(claims.aud) ? claims.aud.includes(appId) : claims.aud === appId;
  if (!audOk) throw new GameError('auth_failed', 'Privy token is for another app.');
  if (claims.iss !== 'privy.io') throw new GameError('auth_failed', 'Unexpected or missing Privy issuer.'); // (red-team R12 LOW-1) mandatory iss — was fail-open on an absent claim (Privy always sets 'privy.io')
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new GameError('auth_failed', 'Privy token expired or non-expiring.');
  if (!claims.sub) throw new GameError('auth_failed', 'Privy token has no subject.');
  return { provider: 'privy', subject: String(claims.sub) };
}

// Find-or-create the account for a verified identity. Returns {accountId, created}.
// UNIQUE(auth_provider,auth_subject) makes the create race-safe: on a concurrent
// double sign-in one INSERT wins, the loser catches the conflict and adopts the row.
export async function accountForIdentity(pool, { provider, subject }, ip, invite) {
  const existing = (await pool.query('SELECT id, status FROM accounts WHERE auth_provider=$1 AND auth_subject=$2', [provider, subject])).rows[0];
  if (existing) {
    if (existing.status === 'banned') throw new GameError('banned', 'This account is banned.');
    await pool.query('UPDATE accounts SET last_ip=$2 WHERE id=$1', [existing.id, ip]);
    return { accountId: existing.id, created: false };
  }
  const id = crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // (red-team B2) consume the invite ATOMICALLY with creation — inside the same txn, so exactly one
    // invite is burned per created account: a concurrent second callback for the SAME new identity
    // either loses the accounts insert race (adopts, no consume) or is deduped by the caller. An
    // exhausted invite throws here and rolls the whole create back → the gate is never bypassed.
    await consumeInvite(client, invite);
    await client.query('INSERT INTO accounts (id, auth_provider, auth_subject, created_ip, last_ip) VALUES ($1,$2,$3,$4,$4)',
      [id, provider, subject, ip]);
    await client.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [id]);
    await client.query('COMMIT');
    return { accountId: id, created: true };
  } catch (e) {
    await client.query('ROLLBACK');
    const row = (await pool.query('SELECT id, status FROM accounts WHERE auth_provider=$1 AND auth_subject=$2', [provider, subject])).rows[0];
    if (row) { // lost the create race — adopt the winner's row
      if (row.status === 'banned') throw new GameError('banned', 'This account is banned.');
      return { accountId: row.id, created: false };
    }
    throw e;
  } finally { client.release(); }
}

const guestBootstrapLocks = new Map();
const GUEST_BOOTSTRAP_TTL_MS = 10 * 60 * 1000;
async function withGuestBootstrapLock(recoveryHash, operation) {
  const previous = guestBootstrapLocks.get(recoveryHash) || Promise.resolve();
  let release;
  const current = new Promise((resolveCurrent) => { release = resolveCurrent; });
  guestBootstrapLocks.set(recoveryHash, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (guestBootstrapLocks.get(recoveryHash) === current) guestBootstrapLocks.delete(recoveryHash);
  }
}

// Agent Alpha cannot authenticate its first guest request with an account-scoped idempotency key:
// no account or bearer exists yet, and auth routes are intentionally outside that hook. Instead the
// client writes a random 256-bit recovery credential before network I/O. The server stores only its
// domain-separated hash. A short process-local queue makes same-process retries deterministic (and
// keeps pg-mem honest); the unique index is the cross-process backstop. Invite consumption, account,
// and persistent state commit together. Recovery is deliberately finite: only the unretired original
// guest/token-version/no-character/no-agent state may use the proof, and it expires after ten minutes.
async function recoverCommittedGuestBootstrap(pool, recoveryHash, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query(
      `SELECT id, status, auth_provider, token_version, guest_bootstrap_expires_at,
              guest_bootstrap_token_version, guest_bootstrap_retired_at
         FROM accounts WHERE guest_bootstrap_hash=$1 FOR UPDATE`,
      [recoveryHash],
    )).rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return null;
    }
    if (row.status === 'banned') throw new GameError('banned', 'This account is banned.');
    const persistent = (await client.query(
      'SELECT COALESCE(agent_flag,false) AS agent FROM account_persistent WHERE account_id=$1',
      [row.id],
    )).rows[0];
    if (!persistent) {
      throw new GameError('bootstrap_contention', 'Guest bootstrap is still committing.');
    }
    const hasCharacter = (await client.query(
      'SELECT 1 FROM characters WHERE account_id=$1 LIMIT 1', [row.id],
    )).rowCount > 0;
    const originalVersion = row.guest_bootstrap_token_version;
    if (row.guest_bootstrap_retired_at || row.auth_provider !== 'guest' || persistent.agent ||
        hasCharacter || originalVersion === null || originalVersion === undefined ||
        Number(row.token_version) !== Number(originalVersion)) {
      throw new GameError('bootstrap_retired', 'Guest bootstrap recovery is retired.');
    }
    const expiresAt = new Date(row.guest_bootstrap_expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new GameError('bootstrap_expired', 'Guest bootstrap recovery has expired.');
    }
    await client.query('UPDATE accounts SET last_ip=$2 WHERE id=$1', [row.id, ip]);
    await client.query('COMMIT');
    return { accountId: row.id, created: false, tokenVersion: Number(originalVersion) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function accountForGuestBootstrap(pool, recoverySecret, ip, invite) {
  if (typeof recoverySecret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(recoverySecret)) {
    throw new GameError('bootstrap_credential', 'Invalid guest bootstrap credential.');
  }
  const secretBytes = Buffer.from(recoverySecret, 'base64url');
  if (secretBytes.length !== 32 || secretBytes.toString('base64url') !== recoverySecret) {
    throw new GameError('bootstrap_credential', 'Invalid guest bootstrap credential.');
  }
  const recoveryHash = crypto.createHash('sha256')
    .update('omerta-agent-alpha-guest-bootstrap-v1\0')
    .update(secretBytes)
    .digest('hex');
  return withGuestBootstrapLock(recoveryHash, async () => {
    const existing = await recoverCommittedGuestBootstrap(pool, recoveryHash, ip);
    if (existing) return existing;

    const id = crypto.randomUUID();
    const tokenVersion = 0;
    const expiresAt = new Date(Date.now() + GUEST_BOOTSTRAP_TTL_MS);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await consumeInvite(client, invite);
      await client.query(
        `INSERT INTO accounts
           (id, auth_provider, auth_subject, created_ip, last_ip, guest_bootstrap_hash,
            guest_bootstrap_expires_at, guest_bootstrap_token_version)
         VALUES ($1, 'guest', $1, $2, $2, $3, $4, $5)`,
        [id, ip, recoveryHash, expiresAt, tokenVersion],
      );
      await client.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [id]);
      await client.query('COMMIT');
      return { accountId: id, created: true, tokenVersion };
    } catch (error) {
      await client.query('ROLLBACK');
      // A different server process may have won the unique-index race. Its committed mapping is
      // authoritative; adopting it is recovery, while an absent/incomplete row keeps us fail-closed.
      const winner = await recoverCommittedGuestBootstrap(pool, recoveryHash, ip);
      if (winner) return winner;
      throw error;
    } finally {
      client.release();
    }
  });
}

// The bearer is already durable before Agent Alpha calls this route. Keep the hash as a one-way
// consumed-proof tombstone so the same stale proof can never create a second account after retirement.
export async function acknowledgeGuestBootstrap(pool, accountId) {
  await pool.query(
    `UPDATE accounts
        SET guest_bootstrap_retired_at=COALESCE(guest_bootstrap_retired_at, now())
      WHERE id=$1 AND guest_bootstrap_hash IS NOT NULL`,
    [accountId],
  );
  return { ok: true };
}

// Guest → provider upgrade: same account row, so possessions survive (§4). The
// UNIQUE constraint is the real guard — the pre-check is just a friendlier error.
export async function upgradeAccount(pool, accountId, { provider, subject }) {
  const acct = (await pool.query('SELECT auth_provider FROM accounts WHERE id=$1', [accountId])).rows[0];
  if (!acct) throw new GameError('no_account', 'No such account.');
  if (acct.auth_provider !== 'guest') throw new GameError('not_guest', 'Only guest accounts upgrade.');
  const taken = (await pool.query('SELECT id FROM accounts WHERE auth_provider=$1 AND auth_subject=$2', [provider, subject])).rows[0];
  if (taken) throw new GameError('linked_elsewhere', 'That identity already has an account.');
  try {
    await pool.query(
      `UPDATE accounts SET auth_provider=$2, auth_subject=$3,
         guest_bootstrap_retired_at=COALESCE(guest_bootstrap_retired_at, now()) WHERE id=$1`,
      [accountId, provider, subject],
    );
  } catch { // lost the race to another upgrade/sign-in for the same identity
    throw new GameError('linked_elsewhere', 'That identity already has an account.');
  }
  return { ok: true, provider };
}

// Closed-alpha invite gate: atomically consume one use of a valid code (INVITE_MODE=on).
// The guarded UPDATE is the whole check — a SELECT-then-UPDATE would let concurrent
// signups all pass on a single 1-use code and drive uses_left negative.
export async function consumeInvite(pool, code) {
  if ((process.env.INVITE_MODE || 'off') !== 'on') return true;
  const r = await pool.query('UPDATE invite_codes SET uses_left = uses_left - 1 WHERE code=$1 AND uses_left > 0', [String(code || '')]);
  if (r.rowCount !== 1) throw new GameError('invite', 'This alpha is invite-only. Ask a made man for a code.');
  return true;
}

// ── ONE-CLICK X SIGN-IN (OAuth2 + PKCE, server-side code exchange) ─────────────────────────────
// The "real path" the E-H1 audit prescribed: the console never handles a provider token. The
// client asks /v1/auth/x/start for an authorize URL (the state + PKCE verifier persist in
// oauth_states — the bearer never rides a URL, and an authed start binds the state to the guest
// account for a claim-in-place upgrade); X redirects back to /v1/auth/x/callback, where the
// SERVER exchanges the code (so the token was provably issued to OUR app — no confused deputy),
// reads /2/users/me, and either upgrades the bound guest or signs the identity in. DORMANT unless
// X_CLIENT_ID + PUBLIC_URL are set (register the X app's callback as PUBLIC_URL + the callback
// path; X_CLIENT_SECRET optional — set it for a confidential client, omit for public PKCE).
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const xOAuthConfigured = () => !!(process.env.X_CLIENT_ID && (process.env.PUBLIC_URL || process.env.SOCIAL_GAME_URL));
const xRedirectUri = () => `${(process.env.PUBLIC_URL || process.env.SOCIAL_GAME_URL || '').replace(/\/$/, '')}/v1/auth/x/callback`;

export async function xOAuthStart(pool, { accountId = null, invite = null } = {}) {
  if (!xOAuthConfigured()) throw new GameError('oauth_unconfigured', 'One-click X sign-in is not configured on this server.');
  const state = b64url(crypto.randomBytes(24));
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  await pool.query(
    'INSERT INTO oauth_states (state, verifier, purpose, account_id, invite) VALUES ($1,$2,$3,$4,$5)',
    [state, verifier, accountId ? 'upgrade' : 'login', accountId, invite ? String(invite).slice(0, 64) : null]);
  const u = new URL('https://x.com/i/oauth2/authorize');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', process.env.X_CLIENT_ID);
  u.searchParams.set('redirect_uri', xRedirectUri());
  u.searchParams.set('scope', 'users.read tweet.read');
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return { url: u.toString(), state }; // state returned so the route can browser-bind it (anti-CSRF cookie)
}

// Returns { purpose, accountId, invite, identity } — the route decides upgrade vs login + signs.
export async function xOAuthCallback(pool, { code, state }) {
  if (!xOAuthConfigured()) throw new GameError('oauth_unconfigured', 'Not configured.');
  // single-use: DELETE-returning claims the state atomically (a replayed callback finds nothing)
  const st = (await pool.query(
    'DELETE FROM oauth_states WHERE state=$1 AND created_at > $2 RETURNING verifier, purpose, account_id, invite',
    [String(code ? state : ''), new Date(Date.now() - 15 * 60000)])).rows[0];
  if (!st) throw new GameError('oauth_state', 'Sign-in expired or already used — try again.');
  const form = new URLSearchParams({
    grant_type: 'authorization_code', code: String(code),
    client_id: process.env.X_CLIENT_ID, redirect_uri: xRedirectUri(), code_verifier: st.verifier,
  });
  const headers = { 'content-type': 'application/x-www-form-urlencoded' };
  if (process.env.X_CLIENT_SECRET) {
    headers.authorization = 'Basic ' + Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64');
  }
  const tok = await xApiFetch('https://api.x.com/2/oauth2/token', { method: 'POST', headers, body: form });
  const tj = await tok.json().catch(() => ({}));
  if (!tok.ok || !tj.access_token) throw new GameError('oauth_exchange', 'X refused the sign-in — try again.');
  const me = await xApiFetch('https://api.x.com/2/users/me', { headers: { authorization: `Bearer ${tj.access_token}` } });
  const mj = await me.json().catch(() => ({}));
  if (!me.ok || !mj.data?.id) throw new GameError('oauth_me', 'X did not return a profile — try again.');
  return { purpose: st.purpose, accountId: st.account_id, invite: st.invite,
    identity: { provider: 'x', subject: String(mj.data.id) } };
}
