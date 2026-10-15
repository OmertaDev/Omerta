## `confirm` in src/gateway/service.js (L76-L106)

**Purpose:** Converts an exact player-approved proposal into an existing authoritative game command.

**Inputs & Assumptions:** Account ID and player Authorization are supplied by the authenticated player route (`routes/gateway.js:L70,L80`). Preparation ID and nonce/digest body are untrusted.

**Outputs & Effects:** Reads owner-bound proposal, marks executing, dispatches game route, records completed/refused/executing receipt summary. Throws on stale/unavailable/expired authority or dispatch failure (`L77-L105`).

**Block-by-Block:**

```js
// L79-L85
const row = await loadPreparation(accountId, preparationId);
if (row.nonce !== input.nonce || row.digest !== input.digest) fail('confirmation_mismatch', 409);
```

Closed input validation precedes owner lookup and nonce/digest comparison. Current grant/scope checks precede completed replay; expiry then limits pending/executing states (`L77-L85`). Pending state recomputes the full preview digest; executing skips it (`L89-L92`). The conditional state update precedes a rederived allowlisted dispatch with immutable `gateway-<id>` key (`L93-L97`). Response class determines saved final or retry state (`L98-L105`).

**Cross-Function Dependencies:** `loadPreparation` filters both ID and account (`L19-L24`); `security.revalidate`; scope helper; context preview; `actionTarget`; game dispatch. Downstream item/coordination idempotency owns concurrency and restart replay, because the Gateway has no enclosing transaction/lock across dispatch. Exceptions after marking executing leave that recoverable state.

**Open Questions:** A distinct marker for proven-not-executed HTTP 409/429 versus uncertain commit: **nothing found**. Post-expiry reconciliation path: **nothing found**. Readiness/consent semantics under retryable known refusal need adversarial checking separately.
