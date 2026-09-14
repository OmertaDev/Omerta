# Coordination security invariants

Scope: the Phase 00–01 executable profiles and HTTP integration. The [repository review policy](../../omerta-contracts/SECURITY-REVIEW-POLICY.md) governs release conclusions. These properties do not clear planned financial adapters, delegated organization execution or AI generation.

| ID | Required property | Evidence |
| --- | --- | --- |
| C00-01 | Definitions admit only bounded canonical data and known predicates; no executable callbacks, effects or client state providers | `test/coordination-graph.js` hostile schema/prototype/function/symbol/accessor and complexity cases |
| C00-02 | Persisted ID/version/hash is immutable through APIs; later registry selection cannot rewrite an existing run | `test/coordination.js` successor/retirement/replacement cases |
| C00-03 | Players receive only their owned projections; hidden IDs, conditions, actor tuples and private audit never enter public responses | Compiler/runtime tests and `test/coordination-api.js` projection/error contracts |
| C00-04 | Actor identity, level, location, clock and progress derive from locked server state | Runtime gate/forged-body tests; PostgreSQL lock probes |
| C00-05 | One issued action consumes one current revision; stale, hidden and fabricated actions do not change progress or audit | Same-revision concurrent requests, forged actions, stale tests |
| C00-06 | Exact retries create no second effect/event; a key cannot be rebound to a different request | Domain receipt and outer HTTP replay tests |
| C00-07 | Progress, lifecycle audit and receipt commit together; rollback exposes no partial state; uncertain COMMIT never erases committed work | Ten fault boundaries in memory and PostgreSQL, commit-acknowledgement-loss test |
| C00-08 | Death/replacement never changes historical owner; heirs can inspect/cancel history but cannot execute its actions | Death, heir and cancellation-actor tests |
| C00-09 | Disabling rollout or excluding an account stops new work while preserving historical inspection/cancellation/replay | Flag/cohort tests |
| C00-10 | Coordination cannot alter cash, OMR, inventory, character stats, referrals or Agent Act authority | Exact character snapshots, zero transaction rows, executable profile closure, API/agent separation tests |
| C00-11 | Error responses do not reveal whether a foreign/hidden identifier exists or include SQL/internal exception details | Route error mapping and non-enumeration tests |
| C00-12 | Completed/cancelled runs cannot execute again; graph version changes do not reset a character's run entitlement | Unique character/graph constraint and closed-instance tests |

The compiler checks structural dependency paths, not full story solvability. The runtime assumes database administrator integrity and the existing token/auth perimeter. Application append-only behavior is not a claim that a database superuser cannot edit records. Module-level pg-mem serialization is not a multi-process lock proof; PostgreSQL tests are required for those claims.

| ID | Phase 01 property | Evidence |
| --- | --- | --- |
| C01-01 | Only an executed same-hash hidden-task discovery issues one authentic immutable original claim | Compiler, knowledge helper/runtime source validation and fault tests |
| C01-02 | A gate needs two configured roots, distinct original accounts/receipts, matching semantics and no eligible contradiction; copies/assertions add no authority | Knowledge runtime journeys, same-account/heir/contradiction/exact-hash cases |
| C01-03 | Current Crew/Family membership and ACL are revalidated under compatible locks; stale boards never grant authority | Real PostgreSQL both-order read/revoke/kick and gate races |
| C01-04 | Forbidden/missing claims are equivalent; links and archives hide unreadable endpoints; receipts omit foreign evidence | Helper/runtime/API recursive projection checks and PostgreSQL archive/receipt checks |
| C01-05 | Targets/cursors bind purpose/caller/expiry; a target's organization is rechecked at use; no raw principal nomination | Forgery, wrong caller/purpose, stale target and strict API tests |
| C01-06 | ACL revisions, event history and current projections commit together; reconstruction changes no original claim | Helper rebuild/fault tests and runtime real PostgreSQL rollback/receipt tests |
| C01-07 | Disabling creation/sharing preserves owner history, revocation and original-account recovery; death grants no old-run or Family inheritance | Flag/cohort, historical-owner and PostgreSQL death/heir tests |
| C01-08 | Scan/cap exhaustion fails closed, and capacity remains for all active-grant revocations | Bounded helper/compiler tests; no mass-scale capacity claim |

Future phases must add tests for delegated approval consumption/revocation/expiry, typed escrow conservation, branch reconciliation, private commit/reveal, generator abuse and seasonal inheritance. A new primitive must preserve the existing invariants.
