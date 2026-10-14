## `authenticate` in src/gateway/security.js (L78-L85)

**Purpose:** Converts only a delegated bearer into an internal principal.

**Inputs & Assumptions:** Authorization is untrusted HTTP header. Optional provider is route-owned (`routes/gateway.js:L56-L57`).

**Outputs & Effects:** Returns current authority or refuses 401/403. Reads token hash lookup and current grant; no writes.

**Block-by-Block:**

```js
// L79-L80
if (typeof authorization !== 'string' || !/^Bearer ogw_[A-Za-z0-9_-]{43}$/.test(authorization)) fail('invalid_token', 401);
const digest = hash(authorization.slice(7));
```

Strict framing precedes hash lookup; unresolved lookup passes missing identifiers to revalidate, which refuses. Successful revalidation precedes provider comparison (`L81-L84`).

**Cross-Function Dependencies:** `hash` implements SHA-256 (`L14`); revalidate checks current grant/account state on all successful token lookup paths. The route pins Muse provider; neutral endpoints deliberately permit other providers.

**Open Questions:** None within this function's defined credential semantics.
