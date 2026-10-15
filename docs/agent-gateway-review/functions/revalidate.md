## `revalidate` in src/gateway/security.js (L67-L77)

**Purpose:** Reconstructs current delegated authority rather than trusting cached caller scopes.

**Inputs & Assumptions:** Internal principal identifies connection/account, initially supplied by token lookup or owned proposal. The injected database/clock are trusted (`L66`).

**Outputs & Effects:** Returns fresh account/connection/provider/scopes/version/expiry or throws 401. Reads only.

**Block-by-Block:**

```js
// L72-L74
if (!row || row.account_id !== principal.accountId || row.revoked_at || row.account_status !== 'active'
    || new Date(row.expires_at).getTime() <= now()
    || Number(row.token_version) !== Number(row.current_version)) fail('invalid_token', 401);
```

The joined lookup precedes identity, revocation, account status, expiry and credential-version checks, then returns scopes from the stored grant (`L69-L76`). Later authorization relies on these fresh scopes.

**Cross-Function Dependencies:** Parameterized `pool.query` is the database authority. Called by authenticate, execute, confirm, and event gateway delivery. Connection creation/revocation and account changes share these rows.

**Open Questions:** Database/time failures propagate to route error mapping. No transaction binds this read to later game execution; the game route rechecks player authentication.
