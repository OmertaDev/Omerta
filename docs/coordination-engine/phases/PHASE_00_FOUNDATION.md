# Coordination Phase 00 — Foundation

Status: implemented for scoped review, production disabled by default. This phase is separate from the repository's existing world-graph Phase 1 and sealed-content Phase 2.

## Result

An authenticated player can open a source-controlled private graph, discover two hidden leads, complete both, and resolve the terminal through server-issued actions. The service retains exact revision, owner history, content identity, audit and replay receipts across process restarts. It neither grants a reward nor alters any existing game ledger.

## Files and contracts

Implementation: `src/coordination/graph.js`, `pilot.js`, `runtime.js`, `src/routes/coordination.js`; additive schema in `schema.sql`; server registration and explicit gateway contracts; rollout variables in preflight and `.env.example`. See [data model](../DATA_MODEL.md) for exact predicates, payloads, state transitions and errors. [Architecture](../ARCHITECTURE.md) defines transaction/visibility ownership.

The graph schema is version 1 and deliberately bounded. New work uses the branded code-selected registry. Existing work uses persisted immutable source; ID/version replacement refuses. Instance states are `active → completed` or `active → cancelled`. Node discovery and completion are separate explicit actions for hidden nodes. A join can depend on ALL, ANY or M-of-N predicates. Later phases add failure branches and role/knowledge predicates under a new reviewed profile, not through arbitrary metadata.

## Acceptance

1. Complete The Dead Letter through the direct HTTP API; hidden nodes become visible only after authorized discovery and the conclusion requires both leads.
2. Refuse unknown graph fields, effects, unsafe executable values, invalid references, cycles, duplicated threshold conditions and complexity overflow.
3. Recheck locked identity, current revision and current server predicates on each action. Concurrent sibling actions commit at most one transition.
4. Exact retries replay a stored receipt; conflicting reuse refuses. No event or state survives a failed transaction. An ambiguous COMMIT is resolved by the same logical receipt.
5. Existing runs survive new selected versions and retirement; original owner tuples survive death; heirs cannot progress old runs but accounts can inspect/cancel them.
6. Feature/cohort controls suppress new work. Cancellation and historical reads remain available while disabled.
7. Character/economic state and transaction ledger remain unchanged by the pilot. Discovery is outside Agent Act authority.
8. Run memory/compiler/HTTP tests and isolated PostgreSQL tests, retain source-specific results and review findings.

## Migration and rollout

Apply the additive schema through existing boot tooling. There is no backfill, live graph upload, background job or external service. Deploy disabled; select an explicit account cohort for an intended pilot; run the direct journey; inspect private operator totals and failures; decide expansion separately. Empty cohort configuration means all authenticated accounts only when the main flag is on.

Disable by setting `COORDINATION_ENGINE=off` and restarting. Do not remove definitions, instances, events or receipts. Definitions and owner tuples are not estate assets. No money or item reconciliation is required. Preserve replay even when the outer HTTP receipt is missing after a server interruption.

## Exclusions and next dependency

This phase does not deliver dynamic Crew/Family ACLs, immutable knowledge claims, earned trust, secret participant roles, threshold approval, durable asynchronous consumers, economy adapters, mass operations, AI-generated content or a graphical console. Phase 01 begins at the claim/provenance contract in [its specification](PHASE_01_KNOWLEDGE.md); it must reuse this replay and audit boundary and prove new sharing/independence semantics.
