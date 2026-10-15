## `register` in src/routes/gateway.js (L24-L134)

**Purpose:** Wires HTTP identity classes, error framing, safe internal game dispatch, discovery, events, and player UI.

**Inputs & Assumptions:** Fastify app, database, existing JWT auth and coordination services are trusted dependencies. Optional context/dispatch overrides are internal test injection, not HTTP fields (`L24-L36`).

**Outputs & Effects:** Registers player, delegated, and public endpoints; closes owned event streams on shutdown (`L38`). Mutations flow into the corresponding service.

**Block-by-Block:**

```js
// L70-L71
const player = { preHandler: [auth, playerOnly], bodyLimit: 16384 };
const delegated = { preHandler: gatewayAuth, bodyLimit: 16384 };
```

Service construction binds dispatch to `app.inject` POST with player Authorization and fixed idempotency header (`L28-L32`). Error wrapper allows stable 4xx codes and hides unclassified exceptions (`L39-L49`). Gateway auth authenticates and provider-binds requests before handlers; player guard refuses agent JWTs and cross-host Origins (`L51-L69`). All control routes use player options; capabilities/calls/subscriptions/events use delegated options (`L74-L125`). Public endpoints contain configuration/assets, with private no-store and frame denial for UI assets (`L123-L131`).

**Cross-Function Dependencies:** Existing JWT auth verifies signature/account/version; delegated security verifies grant/hash/current account; gateway handles capability and proposal authority; events own per-delivery checks. Fastify must stop processing after a preHandler sends its error response. Game dispatch returns only status and error code rather than raw private game response (`L31-L32`).

**Open Questions:** Same-Origin checking compares host, not scheme (`L66-L67`), while requests without Origin are allowed for API use. TLS and deployment proxy trust remain deployment assumptions outside this file. Shared application request logging/redaction requires deployment review; no token is placed in a query parameter by this module.
