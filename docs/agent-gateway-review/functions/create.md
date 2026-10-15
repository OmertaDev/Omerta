## `create` in src/gateway/security.js (L86-L98)

**Purpose:** Issues player-authorized delegated credentials.

**Inputs & Assumptions:** Account ID is trusted JWT subject through `[auth,playerOnly]` (`routes/gateway.js:L70,L76`). Input is untrusted and validated against closed provider/label/scope/TTL schemas (`security.js:L55-L60,L87`).

**Outputs & Effects:** Inserts a grant with token hash and current account version; returns plaintext token once (`L93-L97`).

**Block-by-Block:**

```js
// L90-L91
const id = crypto.randomUUID(), token = 'ogw_' + crypto.randomBytes(32).toString('base64url');
const expiresAt = new Date(now() + (input.expiresInSeconds || 86400) * 1000).toISOString();
```

Input and active-account checks precede random generation. The trusted clock determines expiry; insertion stores the hash, while response returns the plaintext and grant metadata (`L88-L97`).

**Cross-Function Dependencies:** Node crypto randomness; parameterized database insertion with unique token hash (`schema.sql:L7132`). Revocation/version validation later uses the inserted values.

**Open Questions:** Scope `omerta.actions.commit` is an available explicit grant but absent from UI defaults; policy depends on confirm remaining mandatory. Grant-count retention/quotas are not established here.
