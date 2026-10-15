## `execute` in src/gateway/service.js (L43-L75)

**Purpose:** Central agent call authority and request/audit identity.

**Inputs & Assumptions:** Principal is internal but revalidated. Name, args and request ID are untrusted. Registry, context and database are trusted constructor inputs (`L6-L7`).

**Outputs & Effects:** Returns scoped context or a proposal envelope. Inserts/updates request audit state; can insert preparation. Never directly dispatches a game mutation (`L61-L63`).

**Block-by-Block:**

```js
// L44-L45
const principal = await security.revalidate(rawPrincipal);
await security.rateLimit(principal);
```

Current authorization and quota precede request work. Request ID/name validation and canonical argument hash precede an insert-or-existing lookup; a different hash is refused (`L46-L56`). Scopes and closed argument validation precede context/preparation dispatch (`L58-L63`). Success or caught failure updates audit state (`L64-L74`).

**Cross-Function Dependencies:** `revalidate`, shared SQL rate bucket, `allowed`, `validate`, `context.execute`, `prepare`. Canonical hash excludes account because connection ID owns the replay domain. Repeated reads invoke current context; repeated preparations use stored state. Database uniqueness is `(connection_id,request_id)` (`schema.sql:L7155`).

**Open Questions:** Pre-try refusals and malformed adapter framing do not get the same audit update path. A single request row represents retries rather than append-only attempts.
