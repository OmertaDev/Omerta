# Coordination Phase 03 — Asynchronous operations

Status: planned after Coordination Phases 00–02. This is a new bounded orchestration capability; existing `src/operations.js` and `world_operations` keep their current world-graph authority. Product intent: [shared brief](https://chatgpt.com/share/6aa68e3e-9ad8-83ea-ab47-b9c624dce707).

## Result and state machine

Participants prepare a plan, consent to exact commitments, fill private role branches asynchronously, and receive a deterministic resolution. They need not be online simultaneously.

Compile an explicit lifecycle: `planning → committing → locked → executing → resolving → completed`. Every phase has a documented cancellation or failure transition. Partial success is a typed terminal outcome attached to completion, not an ambiguous half-written state. Deadlines use database time captured once per command. The graph declares which commitments remain revocable, what locks at the deadline, what missing participation means, and which existing effects can be applied. The initial pilot remains value-neutral.

Add `src/coordination/operations.js` and lifecycle validation in `src/coordination/graph.js`. Proposed tables:

| Table | Responsibility |
| --- | --- |
| `coordination_operation_plans` | Pinned graph/run, frozen plan hash, lifecycle state, deadline, organizer scope, revision. |
| `coordination_operation_commitments` | Unique account/role commitment, exact plan revision, consent revision, expiry, cancellation evidence. |
| `coordination_operation_branches` | Compiled branch/role IDs, assignee, private state, revision, deterministic outcome receipt. |
| `coordination_operation_resolutions` | Unique operation resolution identity, frozen input receipt set/hash, rule version, typed outcome and effect receipt references. |

Use existing `coordination_commands` and `coordination_events` for requests and event history; do not introduce a parallel generic workflow queue.

## Proposed API and projections

Extend coordination discovery with permitted operation summaries. Proposed `/v1/coordination/operations/:operationId` serves shared state; sibling `/role` serves only the caller's assigned branch. Proposed mutations `/commit`, `/withdraw`, `/lock`, `/contribute`, `/resolve`, and `/cancel` require the current board-issued descriptor, expected revision, and idempotency key. Prefer exposing those descriptors through one strict dispatcher once the lifecycle vocabulary is stable.

A shared board contains aggregate readiness and allowed next transitions. It must not contain private branch IDs, answers, hidden participant identities, or individual vote choices. Public failure reasons cannot reveal which secret branch caused failure. Every submitted branch/action ID is revalidated against the caller's current role under lock.

## Atomicity and recovery

For one participant mutation, lock the original living character, then operation and that participant's branch in the documented common order; update the branch, shared revision, receipt, and event in one transaction. Locking a plan rechecks live membership and consent and freezes its exact input set. A membership change after lock follows the compiled policy: historical participation remains, but no new private action is authorized solely by the old commitment.

Resolution is a unique, deterministic transition from a closed set of branch receipts. Do not hold locks while waiting for people, doing RPC, calling a model, or checking a remote service. A bounded deadline scanner may issue the same internal command as a player-triggered overdue check; both converge on one receipt. A scanner is a scheduling mechanism, never extra authority.

Cancellation must exist from every nonterminal phase. Before economic integration, cancellation releases only coordination commitments. Phase 04 must attach exact domain release receipts before value-backed commitments can activate. Death never changes historical assignees or grants a successor access to secret branches. The compiled policy decides whether a lost role yields a declared partial outcome or cancellation; it cannot silently substitute another player.

Old runs retain their exact definition and deadline policy after activation replacement. New code must read old states or disable new starts while leaving old cancellation and inspection available. A retry with the same key recovers the same command; a new key cannot cause a second resolution.

## Acceptance and rollout

- Cover each transition and every cancellation edge, invalid phase, stale revision, deadline boundary, and repeat resolve.
- Exercise branch-private projection tests and hidden/missing/foreign identifier equivalence, following the existing `test/worldgraph-api.js` and `test/content-social.js` regression patterns.
- Race commitment, withdrawal, plan locking, membership exit, death, timeout, and manual resolve on PostgreSQL.
- Inject failure between each state write and receipt/event append; no partially committed resolution survives.
- Replay terminal history to reproduce the same frozen inputs and outcome. Verify absent item, cash, OMR, reward, and Agent Turn authority.

Planned flag `COORDINATION_OPERATIONS=on` depends on the prior gates. Roll out one private operation, then a small Crew cohort, then additional compiled roles. Roll back by refusing new commitments/starts, retaining valid contributions only where safe, and preserving cancellation and terminal receipts. Do not reset deadlines or erase commitments to make an old binary fit.

Out of scope: hundreds of participants, open-ended user workflows, live combat scheduling, automatic borrowing, arbitrary effect handlers, and autonomous execution of puzzle answers. Packages: CE-03-01 through CE-03-05.

