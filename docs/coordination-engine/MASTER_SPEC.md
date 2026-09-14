# Coordination Engine — repository-specific master specification

Status: Coordination Phases 00–01 implemented for scoped review; Phases 02–09 planned. Source of product intent: [shared brief](https://chatgpt.com/share/6aa68e3e-9ad8-83ea-ab47-b9c624dce707). Baseline revision and existing architecture are recorded in [REPO_MAP.md](REPO_MAP.md). The original conversation's token estimates are planning guesses, not a budget or a completion claim.

## Objective

Make discovery, interpretation, verification, sharing, specialization, trust, planning and asynchronous execution compose into meaningful cooperative play. Start from tested reusable mechanisms and expand their authority only when a phase has executable acceptance evidence.

OMERTÀ is JavaScript ESM with Fastify and SQL. It already has world-graph item custody, mysteries and Crew operations; hash-pinned authored stories/workshops; sealed item definitions; account-scoped Crews and character-scoped Families; and financial settlement authorities. This plan does not create parallel implementations of those existing ledgers. The coordination runner owns its graph progress, authentic claim provenance, claim access grants, assertions, reference archives, replay receipts and audit. Existing systems retain all gameplay and economic authority.

## Decisions that make the brief implementable

- Separate immutable definitions from mutable run state. A source-controlled registry selects new definitions; existing runs load their exact stored version and content hash.
- Use a closed executable profile. Schema 1 accepts task/terminal nodes, public/hidden node visibility, and eight deterministic predicate kinds. Schema 2 adds typed discovery claims and the fixed two-source `independent_evidence` gate. Unknown fields and economic effects fail validation. The broad vocabulary in the original brief is a roadmap, not an implicit execution allowlist.
- Keep current account, character, Crew, Family, inventory, season and finance tables authoritative. A relationship edge or knowledge claim never overrides them.
- Use the current checked-client transaction wrapper, including its pg-mem compensation discipline. One transaction stores progress, lifecycle audit and replay receipt. No model or client supplies success, actor identity, elapsed time or rewards.
- Distinguish internal audit from public realtime delivery. Phase 00 persists private events and exposes operator aggregate metrics; it does not broadcast them or claim a durable consumer bus already exists.
- Keep permissions explicit. Runs belong to one historical account and character. Phase 01 grants only claim reading to an explicit account or current Crew/Family members. Delegation, organization execution roles and threshold authorization remain later phases.
- Use existing `/v1` and machine-contract conventions. Direct coordination discovery gives no `POST /v1/agent/act` authority.

## Phases and acceptance gates

| Phase | Deliverable | Gate before calling it done |
| --- | --- | --- |
| [00 Foundation](phases/PHASE_00_FOUNDATION.md) | Bounded runner, compiler, ownership, replay, audit, flags | Complete a private fork/join pilot; prove rollback, stale/retry handling, version pinning and no economic effects |
| [01 Knowledge](phases/PHASE_01_KNOWLEDGE.md) | Immutable claims, provenance, sharing, corroboration and archives | Two independent eligible discoveries unlock a node without exposing inaccessible evidence |
| [02 Organizations](phases/PHASE_02_ORGANIZATIONS.md) | Relationship projections, earned trust, capabilities and approvals | Current roles and threshold approval authorize one compartmentalized action exactly once |
| [03 Operations](phases/PHASE_03_OPERATIONS.md) | Commitments, private roles, durable deadlines and partial outcomes | An asynchronous operation survives restart and recovers safely after a failed branch |
| [04 Economy](phases/PHASE_04_ECONOMY.md) | Reviewed crafting/contract/escrow adapters | Existing ledgers conserve value across retry, death, cancellation and definition changes |
| [05 Strategy](phases/PHASE_05_STRATEGY.md) | Canary knowledge, betrayal records and closed consensus mechanics | Private commitments remain private until the declared reveal and resolve once |
| [06 Mass coordination](phases/PHASE_06_MASS_COORDINATION.md) | Independently executable branches and aggregation | Hundreds of participants progress without a single global operation transaction |
| [07 Mystery Director](phases/PHASE_07_MYSTERY_DIRECTOR.md) | Untrusted candidates, validation, simulation and activation | A candidate proves a valid deterministic solution path before deliberate activation |
| [08 Persistent world](phases/PHASE_08_PERSISTENT_WORLD.md) | Institutional/history projections and controlled season inheritance | Only explicitly classified historical consequences cross season boundaries |
| [09 Hardening](phases/PHASE_09_HARDENING.md) | Scoped adversarial, economic, load and recovery evidence | The exact release candidate satisfies its measured release criteria |

Hardening accompanies each phase. Phase 09 consolidates end-to-end evidence; it is not permission to postpone basic privacy, replay or conservation tests.

## Work and integration protocol

The [task index](tasks/TASK_INDEX.md) divides the program into bounded packages. Each task names its dependencies, authoritative interfaces, files and acceptance tests. Give a subagent the relevant task, phase, security invariants and source slice. Parallelize only independent file ownership with settled interfaces; keep migrations, shared interfaces and integration under one owner. Retain a short decision record instead of duplicating architecture in every task.

Before implementing a later package: read current source, update the affected spec if source has moved, state proposed authority changes, add meaningful boundary tests, implement, run affected native checks, and retain evidence. A planned schema or API in a phase document is not an already mounted route. A passing Phase 00 test is not clearance for economy adapters, organization authority or production activation.

## Deliberate exclusions from the foundation

No generic player graph upload; freeform rule execution; AI adjudication; payment, item or OMR effects; public private-event feed; trust farming; threshold money movements; background delivery promises; cross-account role assignment; or seasonal inheritance. None is needed to prove the Phase 00 kernel. Adding one requires its corresponding phase and tests.

## Release policy

Follow the existing [agent-led security review policy](../../omerta-contracts/SECURITY-REVIEW-POLICY.md) for the exact release phase and source. Schema rollout is additive. Deploy code disabled, run isolated checks, select a pilot cohort, inspect scoped telemetry, then separately decide wider activation. Disable new work to roll back; preserve history and replay receipts. No task silently changes game economics or activates a financial rail.
