# Coordination Phase 09 — Release hardening and operational evidence

Status: planned release work, with its minimum relevant checks required in every earlier phase. Phase 09 consolidates the enabled scope; it does not postpone security until after launch. Product intent: [shared brief](https://chatgpt.com/share/6aa68e3e-9ad8-83ea-ab47-b9c624dce707).

## Release boundary and dependencies

Pin the exact source revision, database schema, enabled capability flags, cohort, definition hashes, compiler versions, and external adapter versions. Review only the capabilities actually proposed for release. Follow the repository's [agent-led security review policy](../../../omerta-contracts/SECURITY-REVIEW-POLICY.md); a passing report for one phase or revision does not authorize another.

Use existing `test/worldgraph-api.js`, `test/content-api.js`, `test/phase2-postgres.js`, `tools/pgcheck-belladonna.js`, `tools/concurrency.js`, `tools/chaos.js`, and `tools/loadtest.js` as harness references. Add coordination-specific tests rather than assuming those suites cover new tables or routes. Existing PostgreSQL and pg-mem transaction semantics differ; memory tests cannot prove row-lock safety.

## Required evidence packages

1. **State and authority properties.** Generate bounded valid graphs and command sequences. Prove revision monotonicity; immutable source identity; terminal-state stability; one command result per account/key/fingerprint; deterministic replay; and no action outside the caller's issued capability. Reject unknown fields, invalid Unicode/canonical shapes, malformed stored JSON, oversized graphs, and corrupt event payloads.
2. **ACL and lifecycle matrix.** Exercise owner/nonowner, hidden/missing/foreign IDs, current/former membership, revoked consent, role changes, death/replacement, dissolution, succession, old definitions, and disabled capabilities. Inspect success/error bodies, page counts, logs, metrics, events, and cached projections.
3. **PostgreSQL concurrency.** Race start, act, cancel, replay, activation, last-vote revoke, membership exit, death, branch sealing, and aggregate resolution. Assert authoritative table results and durable receipts. Capture lock ordering and bounded statement time.
4. **Domain invariants.** Value-neutral profiles must leave economic and item tables unchanged. An enabled adapter must pass its own conservation/reserve/escrow proof and recovery cases; coordination success cannot stand in for domain success.
5. **Load and abuse.** Test compiled caps, response bytes, pagination, request-body limits, replay floods, hot partitions, event backlog, and degraded databases. Record environment and observed latency/error distributions. Set rollout admission limits from measured evidence.
6. **Crash and ambiguity.** Inject failures before and after every durable write, during COMMIT acknowledgement, after a domain submission, and during projection delivery. Restore the same logical command without compensating unknown commits. Reconcile pending work without duplicate effects.
7. **Migration and recovery.** Rehearse additive upgrade, interrupted migration, old/new binaries during rollout, backup restore, read-model rebuild, definition retention, and flag shutdown. Demonstrate recovery while keeping immutable ownership and escrow tuples intact.
8. **Operator release.** Produce a concise readiness report, redacted diagnostics, known limitations, tested cohort, kill-switch procedure, outstanding intent count, and rollback evidence. Triage static findings and retain retest evidence for each resolved issue.

## Proposed operational interfaces

Add a read-only `tools/coordination-check.js` for schema/event/receipt/definition consistency and `tools/coordination-replay.js` for bounded owner-authorized or operator-redacted reconstruction. Neither tool repairs by deleting history. A separate, explicitly scoped repair command may append a corrective event only after the exact repair invariant and approval path are implemented.

Derive counters from persisted `coordination_events`, commands, and pending domain receipts. Use closed event kinds, low-cardinality error labels, versioned metric definitions, and no player secret labels. Proposed health output includes stuck command/operation counts, oldest pending receipt age, invalid stored definition count, and projection lag. Never expose private IDs or clues on a public health route.

Every enabled feature retains its independent flag beneath `COORDINATION_ENGINE`; cohort changes affect admission and current authority according to each phase's contract. An emergency disable must preserve authenticated historical inspection and cancellation/release as specified, rather than removing the only recovery route.

## Acceptance and release procedure

Release only when relevant property, API, lifecycle, PostgreSQL race, invariant, migration, and rollback tests pass against the pinned revision, findings are triaged, and no unexplained state discrepancy remains. Record which scenarios require a real database or chain environment and whether they ran; skipped checks cannot be reported as passes.

Roll out to a bounded internal cohort with value-neutral definitions, inspect persisted outcomes, and widen one capability at a time. On rollback, stop new admission, retain recovery, reconcile outstanding intents, switch readers only to compatible projections, and preserve evidence. No down migration may drop command receipts, pinned source bytes, original owner tuples, events, or recoverable escrow.

Out of scope: a claim of universal security, destructive database cleanup, turning on dormant economics to test production, re-auditing unrelated systems without a dependency reason, and replacing operational judgment with a generated pass/fail narrative. Packages: CE-09-01 through CE-09-08.

