# Coordination Engine

Repository-specific implementation of the [shared Coordination Engine brief](https://chatgpt.com/share/6aa68e3e-9ad8-83ea-ab47-b9c624dce707), prepared on 2026-09-13.

Coordination Phases 00–01 are implemented for scoped review: a bounded private graph runner plus immutable discoveries, live sharing permissions, independent-evidence gates, player assertions and personal reference archives. Both pilots are value-neutral and default off. Phases 02–09 remain planned, including delegated organization authority, economic adapters, AI generation and mass operations.

Start with [MASTER_SPEC.md](MASTER_SPEC.md), [REPO_MAP.md](REPO_MAP.md), and [Phase 00](phases/PHASE_00_FOUNDATION.md). For a particular change, use the [task index](tasks/TASK_INDEX.md) and that phase's specification instead of repeatedly reading the full program.

| Reference | Purpose |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Ownership, service boundaries and integration decisions |
| [Data model](DATA_MODEL.md) | Implemented tables, transaction order and API contract |
| [Event catalog](EVENT_CATALOG.md) | Durable audit envelope and exact event semantics |
| [Security invariants](SECURITY_INVARIANTS.md) | Properties and corresponding executable evidence |
| [Test strategy](TEST_STRATEGY.md) | Repeatable checks, isolated PostgreSQL and release requirements |
| [Observability](OBSERVABILITY.md) | Implemented counters, privacy and future measurements |
| [Review](REVIEW.md) | Scoped findings, retests and limitations |
| [Phase 01 review](PHASE_01_REVIEW.md) | Knowledge provenance, live permissions, PostgreSQL races and exact source evidence |
| [Phase 00 verification record](evidence/verification-summary.json) | Historical foundation passes, full repository run, three broader failures and retained logs |
| [Phase 01 verification record](evidence/phase1-verification-summary.json) | Final knowledge suites, PostgreSQL races, affected shared checks and documentation limits |

## Try the foundation locally

Run `npm run test:coordination` to exercise the compiler, pilot journey, private projections and HTTP contract. `npm run test:coordination:postgres` requires an explicitly supplied loopback `COORDINATION_TEST_DATABASE_URL`; it creates and removes a random schema in that disposable database. It never reads `DATABASE_URL`.

The API uses the existing server (`npm start`), authentication and rate limits. Set `COORDINATION_ENGINE=on` in that local server process. An optional comma-separated `COORDINATION_ACCOUNT_IDS` restricts new work to a pilot cohort; omitted/empty means all authenticated accounts. The default is `off`. These are startup settings, so restart the server after changing them.

1. Authenticate through the ordinary existing account flow and create a living character.
2. Read `GET /v1/coordination`. Choose the returned pilot graph and retain its `contentHash`.
3. Send `POST /v1/coordination/:graphId/instances` with `{ "expectedContentHash": "<returned hash>" }` and a fresh `Idempotency-Key`.
4. Send one returned action through `POST /v1/coordination/instances/:instanceId/act`, with the latest `{ "expectedRevision": 0, "actionId": "<issued id>" }` and a fresh key for that logical action. Replace the example revision with the actual returned revision.
5. Continue using the returned instance. On a stale response, refresh its GET route before choosing again. Exact retries keep the original key and body.

The pilot, **The Dead Letter**, has one opening, two independently discoverable leads, and a conclusion requiring both leads. It pays nothing and changes no inventory, stats or gameplay economy. The Phase 0 player surface is the JSON API; a dedicated graphical console is not part of this foundation.

Turning the feature off stops new runs and progress. The authenticated historical owner can still inspect or cancel a run, including after character replacement. Existing command receipts remain replayable. Source installation does not activate production or any chain rail.

## Try distributed knowledge locally

Set `COORDINATION_KNOWLEDGE=on` beneath `COORDINATION_ENGINE=on` to expose **The Split Ledger**. Set `COORDINATION_KNOWLEDGE_SHARING=on` as well to issue sharing targets and read shared evidence. The existing `COORDINATION_ACCOUNT_IDS` cohort applies to both switches. These startup flags default off; neither source installation nor a passing test activates a running server.

Two accounts can each start the returned Split Ledger graph, complete the briefing, and discover a source in its server-required district: the Docks manifest or the Foundry impression. Each investigator completes their local source, then reads `GET /v1/coordination/knowledge` and deliberately shares their claim. Read `GET /v1/coordination/knowledge/targets?characterName=<living character name>` for an opaque account target; omitting the name offers current Crew/Family targets where applicable. Send the target's `id` as `targetId` and the owned claim's latest `aclRevision` as `expectedAclRevision` to `POST /v1/coordination/knowledge/:claimId/share`, with an idempotency key. The target expires after ten minutes and must be refreshed after server restart. Never decode a target to nominate a principal.

Refresh the run after sharing. Two matching original sources from two different accounts unlock discovery and completion of the conclusion. One account collecting both sources cannot supply independence; neither a copy, archive nor player assertion adds another source. Crew/Family permission is checked from current membership whenever evidence is read or used. Revocation invalidates future reads and actions.

The complete contract, safe receipts and rollback behavior are in [Phase 01](phases/PHASE_01_KNOWLEDGE.md) and [the data model](DATA_MODEL.md). This phase ships direct JSON API play; a dedicated graphical console and Agent Turn/Agent Alpha execution are outside its scope.
