## `prepare` in src/gateway/service.js (L26-L42)

**Purpose:** Persists an immutable exact proposal without executing game changes.

**Inputs & Assumptions:** Called after grant/argument/replay checks by execute (`L58-L63`). Context must project safe authoritative state; target is allowlisted.

**Outputs & Effects:** Returns prior proposal or inserts one containing arguments, preview, target, digest, nonce, and ten-minute expiry (`L27-L41`). Player nonce is omitted by `previewView` unless its player flag is true (`L12-L18`).

**Block-by-Block:**

```js
// L27-L31
const prior = (await pool.query(`SELECT * FROM agent_gateway_preparations
  WHERE connection_id=$1 AND request_id=$2`, [principal.connectionId, requestId])).rows[0];
if (prior) return previewView(prior);
const target = actionTarget(name, args);
```

Existing proposal short-circuits before context. New work builds the authoritative preview, random nonce and digest, then uses unique insertion and rereads the winner (`L31-L40`). This supports concurrent identical preparation attempts.

**Cross-Function Dependencies:** `actionTarget`, `context.prepare`, canonical hashing, crypto and SQL unique constraint. Confirm depends on exactly the stored preview/arguments/target digest.

**Open Questions:** Current membership/discovery validation on prior-preview replay: **nothing found**. The appropriate privacy lifetime of historical proposal content needs an explicit decision.
