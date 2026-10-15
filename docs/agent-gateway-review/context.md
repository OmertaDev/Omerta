# Gateway authority context dossier

Phase: implementation review, before native Muse deployment. Recorded 2026-09-21 against base commit `e56cf576065c5f1bbb9bb55115f5961267f7d654` plus dirty working-tree additions. This document builds context; it does not assign findings or certify release readiness.

Method: `audit-context-building`, its `ANALYSIS_FORMAT.md`, worked example, and service-domain notes. The root dispatched this bounded review to a separate agent. Per-function analysis is retained below; the usual one-subagent-per-function fan-out was adapted to the four occupied agent slots. No additional audit framework execution is implied.

| Reviewed file | SHA-256 at this checkpoint |
| --- | --- |
| `src/gateway/security.js` | `586225c8ecb0789c0257ee3a3e98ae0ca4411532857d1a6a76625361410efe8c` |
| `src/gateway/service.js` | `6b4224009285683820c9e65a3aa8190b6a271e1ad2724146f09bd1c68eb3444e` |
| `src/gateway/actions.js` | `95c90c7aba09a0ee31be1db5d90566d9fcec308ff27366bf86083b30e3385cfb` |
| `src/routes/gateway.js` | `b8114065dc884d1c8bd75892ee4b936877b57543eaa9a8909c91d60766279541` |

## Entrypoints and authority

- Public manifest and static player interface return configuration/assets only (`src/routes/gateway.js:L123-L131`).
- Agent routes authenticate an opaque `ogw_` bearer, bind Muse routes to provider `muse`, and retrieve current scopes from storage (`src/routes/gateway.js:L51-L59`; `src/gateway/security.js:L67-L84`).
- Player control routes run existing JWT `auth` followed by `playerOnly`; explicit agent JWTs are refused, and an supplied Origin must match Host (`src/routes/gateway.js:L62-L80`). Existing auth verifies JWT, checks account ban and token version, and accepts legacy JWTs without a version claim (`src/server.js:L933-L958`).
- Agent call body determines capability and arguments, never account identity (`src/routes/gateway.js:L12-L16,L85-L87`; `src/gateway/service.js:L43-L63`).
- Confirmation reads an owned proposal, verifies nonce/digest, rereads current grant, then dispatches an allowlisted existing route using the player's JWT and a stable game key (`src/gateway/service.js:L76-L105`).

## Persistent and external authority

Connections own token hashes, scopes, provider, expiry and token version; requests are unique per connection/request ID; preparations are unique per connection/request ID and contain immutable argument/preview/target/digest/nonce data (`schema.sql:L7126-L7175`). These are separate SQL statements rather than one transaction in the Gateway (`src/gateway/service.js:L26-L40,L43-L74,L76-L105`).

The Gateway stores intent and status; the game owns resource and gameplay changes. WorldGraph dispatch uses `withItemTransaction` and scoped hashed HTTP idempotency keys (`src/routes/worldgraph.js:L145-L151,L429-L436,L475-L485`); item transactions commit or roll back, with explicit unknown-commit classification (`src/items.js:L270-L340`). Crafting enters `withItemMutation` and revalidates actor requirements/cash/input consumption inside it (`src/crafting.js:L738-L775`). Coordination command replay checks fingerprints under actor locks and saves the authoritative response in the same transaction (`src/coordination/runtime.js:L212-L238`).

## Function records

- [validate](functions/validate.md)
- [revalidate](functions/revalidate.md)
- [authenticate](functions/authenticate.md)
- [create](functions/create.md)
- [execute](functions/execute.md)
- [prepare](functions/prepare.md)
- [confirm](functions/confirm.md)
- [actionTarget](functions/actionTarget.md)
- [register](functions/register.md)

Small supporting functions: canonical serialization sorts object keys recursively (`security.js:L15-L20`); hash is SHA-256 (`L14`); connection views omit token hash (`L62-L64`); list/revoke filter by owner (`L99-L107`); rate limiting uses a shared account/minute conditional SQL increment (`L109-L118`); activity filters by connection owner and returns at most 100 request records (`service.js:L107-L116`).

## Assumptions and open questions

1. **Every dispatched game route must honor stable idempotency across process restarts and concurrent confirmations.** Route hashing and the item/coordination transaction boundaries establish the intended mechanism. PostgreSQL concurrency evidence for the newly composed Gateway flow: **nothing found in this context phase**. Memory tests are not proof of production locking behavior.
2. **A stored prior preparation remains suitable to reveal to the current delegate.** `prepare` returns a prior preview before invoking current context (`service.js:L27-L31`). It checks capability scopes upstream, but current membership/discovery revalidation for this prior-preview path: **nothing found**.
3. **An `executing` proposal may skip fresh preview checks.** All HTTP 409/429 and 5xx results enter that state (`service.js:L102`); the skip applies to all of them (`L89`). A stored distinction between a known pre-execution refusal and an uncertain committed outcome: **nothing found**.
4. **Proposal expiry permits adequate reconciliation.** Expiry precedes dispatch even for `executing` (`service.js:L84-L89`). An alternate receipt-reconciliation API after expiry: **nothing found**.
5. **Account ownership is the intended action subject across character death/rebirth.** Existing game routes resolve the current character. Whether every preview binds every economically meaningful subject/version required for consent remains a question for projection review (`src/gateway/context.js:L371-L434`, outside this bounded dossier's function inventory).
6. **Human intent is represented by possession of a player JWT and a UI click.** `playerOnly` rejects JWT `agent:true`, not all accounts with persistent `agent_flag` (`routes/gateway.js:L63`; `server.js:L933-L958`). A stronger human-presence challenge is not implemented; whether required is a product-policy question.
7. **SSE authorization continues after connection establishment.** Registration delegates that property to `events.stream` with `security.revalidate` (`routes/gateway.js:L35,L98-L121`); the separate event review owns its delivery loop and cursor limitations.

Excluded from this bounded authorization dossier: full game-rule re-audit, smart contracts, projection field privacy review, event-loop concurrency, native Muse infrastructure, deployment configuration, and live PostgreSQL proof. These exclusions remain explicit, not implicit assurances.
