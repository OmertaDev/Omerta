# OMERTÀ — backend specification

This document describes the current server architecture. The implementation, runtime rules, schema, and tests are authoritative. Use [SPEC.md](SPEC.md) for the implementation census and debt register, [AGENTS.md](AGENTS.md) for the player API, and [the wiki](docs/WIKI.md) for current gameplay.

## 1. Authority

The server owns balances, timers, prices, outcomes, and randomness. Clients submit authenticated choices. They cannot supply authoritative results or bypass gameplay gates. Public discovery does not grant mutation authority.

## 2. Stack

The backend uses JavaScript modules on Node.js, Fastify, and PostgreSQL. The local test fallback is `pg-mem`; it does not establish production SQL or concurrency correctness. Static browser pages and the MCP package are clients of the same server. `src/worker.js` runs background operations and `src/watcher.js` ingests confirmed chain events.

## 3. Persistence

`schema.sql` defines the schema. `src/db.js` applies supported additive migrations and selects PostgreSQL or the local fallback. Preserve existing account identities, ledger history, immutable content definitions, and custody when evolving the schema. Migration validation must include an existing database, not only a fresh schema.

## 4. Identity and access

`src/auth.js` implements guest and provider authentication. Agent access uses explicit agent credentials, the same gameplay authorities, and agent-specific limits. `src/agentgateway.js`, the OpenAPI surface, and `AGENTS.md` describe discovery. Moderator, signer, and operational capabilities remain separate from player authorization.

## 5. HTTP API

`src/server.js` and `src/routes/` register the routes. `/openapi.json` and the generated [route catalog](knowledge/generated/routes.md) enumerate the current API. Mutating player requests use authentication, route-specific authorization, rate limiting, and idempotency. Preserve existing `/v1` URLs as protocol identifiers.

## 6. Rules and data

`data/rules.js` contains the editable data tables. `node tools/extract-rules.js` regenerates only `src/rules.generated.js`. `src/rules.tail.js` contains hand-maintained constants, catalogs, and helpers; `src/rules.js` exports both halves. Rules changes require the relevant gameplay and balance checks.

## 7. Transaction model

### 7.1 Lazy accrual

Regeneration, income, decay, and other time-based effects are calculated from timestamps through `src/accrual.js` when an actor is touched. Do not add a global player tick or a parallel source of balance changes.

### 7.2 Player actions

Use `withCharacter` and the corresponding multi-actor transaction helpers in `src/game.js`. Acquire locks in the established order, validate inside the transaction, update state and ledger together, and commit before emitting non-fatal notifications.

### 7.3 Gameplay systems

Domain modules implement crime, combat, families, business, the market, inventory, authored stories, coordination, and the living world. Their current rules are documented in `docs/WIKI.md`; source availability and production activation are separate facts. The [core architecture](docs/core-architecture/IMPLEMENTATION.md) describes command and projection ownership.

## 8. Seasons and workers

Season transitions, scheduled settlements, buybacks, and background ingestion must be restart-safe and idempotent. Follow `src/worker.js` and subsystem journals. Exactly one worker is the documented deployment topology unless the deployment configuration and process-local state have been deliberately changed.

## 9. Time and configuration

Use server timestamps and the current rule constants. Test-only timer overrides must not leak into production. `src/preflight.js`, environment examples, and `DEPLOY.md` define configuration requirements. A missing chain or subsystem configuration should preserve its documented dormant behavior.

## 10. Consistency and security

### 10.1 Concurrency

Preserve stable row-lock order, atomic multi-party transfers, and the supported transaction retry behavior. Validate production-specific behavior on real PostgreSQL.

### 10.2 Limits and replay

Apply the shared HTTP rate-limit and idempotency hooks. Exact retries must not repeat rewards, custody changes, or irreversible actions. Do not treat replay or discovery as an authorization bypass.

### 10.3 Administrative access

Keep moderation and operational controls behind their own authentication and scope. Do not expose secrets, private state, or signing material through player or discovery routes.

### 10.4 Ledger invariants

Every value movement writes an enumerated transaction reason and reconciles against its owning balances, escrows, inventories, or reserves. `src/invariants.js` defines current conservation and custody checks. Unknown reasons and unexplained drift are failures. Historical reasons remain readable for existing records without authorizing new faucets.

## 11. Chain settlement

The settlement rail is EVM-based. `src/chain.js` handles wallet linking and signed vouchers; `src/watcher.js` consumes confirmed events with persisted cursors and replay protection. Contract names, typed-data domains, event signatures, and deployed addresses are compatibility boundaries.

Use [the contract guide](omerta-contracts/README.md), [chain deployment](CHAIN-DEPLOY.md), and the [canonical market design](omerta-contracts/docs/market/DESIGN.md) for current roles and gates. Code presence does not establish deployment, funding, audit approval, or activation.

## 12. Operations and verification

Run relevant suites and the required CI checks. Changes involving SQL need the real-PostgreSQL gates; contract changes need the scoped contract release checks. Preserve backup, alerting, invariant monitoring, and restart recovery described in `DEPLOY.md` and the release runbooks.

Historical audit reports are indexed in [docs/AUDITS.md](docs/AUDITS.md). Their conclusions apply only to their recorded revision and scope.
