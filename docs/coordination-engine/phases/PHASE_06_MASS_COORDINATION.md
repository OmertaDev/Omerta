# Coordination Phase 06 — Large participant sets

Status: planned after Coordination Phase 03 and the required Phase 01–02 authority contracts. The target is hundreds of participants in bounded independent branches, not one transaction spanning a city. Product intent: [shared brief](https://chatgpt.com/share/6aa68e3e-9ad8-83ea-ab47-b9c624dce707).

## Result and execution model

A compiled operation can divide work into partitions, each with its own role assignments, revision, deadlines, and deterministic completion receipt. A bounded aggregate combines sealed partition receipts into a final result. Participant actions contend on their partition instead of updating the parent operation for every step.

Extend `src/coordination/operations.js`; add `src/coordination/aggregation.js` only for the new aggregation boundary. Reuse existing coordination command/event authority and the database transaction wrapper. Existing `tools/loadtest.js`, `tools/concurrency.js`, and `tools/chaos.js` are useful harness patterns; their presence is not performance evidence for this feature.

## Proposed storage and API

Add `coordination_operation_partitions` keyed by parent instance plus compiled partition ID, with assignment policy, local revision, status, and unique sealed receipt/hash. Add `coordination_aggregate_inputs` keyed by parent plus partition receipt ID, retaining accepted receipt hash and rule version. Add `coordination_aggregate_results` with a unique parent/resolution identity, frozen input manifest hash, coverage counts, outcome, and revision.

Introduce stable cursor pagination for the participant's assignments and permitted summaries. `GET /v1/coordination/operations/:operationId/partitions` may return only authorized partitions; the shared board reports compiled-safe totals. Existing contribute descriptors name a partition-local expected revision. The final coordinator acts through an issued aggregate command; it cannot substitute client-supplied counts.

Initial enforceable limits: no more than 512 participants per operation, 32 partitions, 16 participants per partition, 100 items per page, and 1 MiB serialized aggregate input manifest. These are proposed test targets, not measured production capacity. The compiler must reject a larger graph until a separately reviewed bound changes.

## Atomicity and deterministic aggregation

A participant mutation locks the original living character and its partition/branch, appends its event, and commits its receipt locally. It does not update a common parent revision. Partition sealing checks its closed membership and branch set under that partition's lock, producing an immutable receipt. The parent aggregate transaction consumes at most the configured 32 sealed receipts in stable partition order.

A receipt is accepted once and bound to parent, partition, definition hash, and aggregation rule version. The aggregate is commutative over its accepted receipt set and deterministic after sorting; arrivals, retries, or worker ordering cannot change the outcome. Missing partitions follow the compiled deadline/partial-success rule. Incremental counters are projections and must be reconciled with the accepted receipt set before terminal resolution.

Consumers, if introduced, read persisted coordination events with a durable cursor and unique effect receipt. Delivery is at least once. Duplicate and out-of-order events are normal inputs; no event alone supplies authority to bypass current policy. The first implementation may use a bounded scanner instead of a new message broker.

Freeze assignment membership where the plan declares it, but recheck current rights to view or mutate private work. Historical assignments survive departure and death; they do not let a new character inherit a private branch. A definition replacement affects new operation starts only. Cancellation closes partitions idempotently and retains their sealed outcomes; it cannot erase completed work to regenerate another receipt.

## Acceptance and rollout

- Run PostgreSQL tests at 512 participants/32 partitions with repeated commands, skewed hot partitions, concurrent sealing, deadline expiry, and final resolution.
- Assert the query/lock trace has no parent lock for ordinary branch contributions. Aggregate lock/query work remains bounded by configured partitions.
- Compare results across randomized partition completion and duplicate-delivery orders; the same receipt set produces identical canonical output.
- Test lost acknowledgement, worker restart, poisoned/dead connection, partial cancellation, and a disabled cohort during execution.
- Check response byte limits, ACL filtering before pagination, no cross-partition leakage, and bounded database statement time. Record observed p50/p95/p99 and failure rates without claiming an unmeasured SLA.

Planned `COORDINATION_MASS=on` requires operation support. Start at two partitions, then raise to eight and 32 only after recorded load evidence. Roll back by stopping large new starts and reducing admission, while allowing accepted partitions to seal/cancel and pending aggregates to reconcile. Do not move historical inputs between partitions or shrink an active operation's compiled limits.

Out of scope: unbounded participant counts, a global consensus service, distributed database transactions, new broker infrastructure without demonstrated need, and streaming private player activity publicly. Packages: CE-06-01 through CE-06-04.

