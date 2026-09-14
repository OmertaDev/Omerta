# Coordination Engine Phase 0 review

Review date: 2026-09-13. Release phase: additive internal foundation, disabled by default.

This review covers the bounded graph compiler, pure predicate evaluator, private instance runtime,
pilot definition, the four new coordination tables, and the narrow HTTP pending-receipt recovery
branch with its coordination route registration. It supplies evidence for this Phase 0
implementation only. It does not clear later coordination phases, existing authored/worldgraph
systems, currency or item rails, production rollout, or the wider OMERTÀ application.

The working tree was already dirty and included unrelated changes. Baseline commit:
`2b3feb7c807848564094c9b56d13fd7e41f97bae`. Exact reviewed working-file hashes appear at the end.

## Method and system model

The review follows [the repository policy](../../omerta-contracts/SECURITY-REVIEW-POLICY.md).
The locally verified method revisions were:

| Method source | Commit | Applied portions |
| --- | --- | --- |
| pashov/skills | `c577eb7799c349de0acb187ba00ca98e14e436fd` | Execution traces, parameter divergence, wrong-state execution, boundary checks, and proof/lead separation. Read `solidity-auditor/SKILL.md`, `references/hacking-agents/shared-rules.md`, and `execution-trace-agent.md`. |
| PlamenTSV/plamen | `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` | Read/write consistency, cross-function state transitions, outside assumptions, and numeric boundaries from `agents/depth-state-trace.md`. The Solidity audit-prep files were inspected but their scored preparation workflow was not run. |
| trailofbits/skills | `d3323cefbcf645678b8dc481de204b02ad3d02dc` | Call-following and trust-boundary mapping from `audit-context-building/SKILL.md` and `resources/DOMAIN_NOTES.md`, specifically the service/database concurrency guidance. |

These methods were adapted to JavaScript and SQL. The upstream Solidity orchestration, specialist
agent census, vulnerability databases, Slither, contract fuzzers, and deployment analysis were not
run. The work used one bounded reviewer alongside the implementing agents, ContextPlus structural
navigation, native source inspection, executable assertions, and isolated PostgreSQL probes.

The reviewed boundary has no value-bearing assets. It owns definition records, instance progress,
command receipts, and lifecycle events. Authentication supplies the account ID; SQL supplies its
current living character, level and location. An instance retains its original account and
character as immutable historical ownership. Only its current original character may advance it;
the stored account may read or cancel it after death or replacement.

Definitions are source-controlled declarative data. The branded immutable registry selects the
definition for new runs. Every instance stores a graph/version/hash tuple; subsequent operations
reload and recompile that persisted definition instead of following the registry's current choice.
Pure rules accept only the closed Phase 0 predicate vocabulary and server-derived state.

Commands lock the current character, then account, then the targeted instance. The account lock
serializes same-account command receipts. Each receipt binds an account/key to a canonical request
fingerprint; a key with a different request refuses. Progress, events and receipts commit together.
`withPhase2Transaction` supplies PostgreSQL rollback and a serialized inverse log for pg-mem;
`withPhase2Read` supplies its corresponding read barrier. A lost COMMIT acknowledgment is uncertain
and resolves by replaying the durable receipt. It is never compensated as a known failure.

The rollout flag blocks new runs and advancement. Historical reads, original-account cancellation,
and exact receipt replays remain available. Receipt replay is evidence of a past transition; it
cannot bypass the flag or current-character checks for a new transition. Hidden definitions are
projected through an allowlist: an undiscovered lead may expose its opaque issued action but not
its node ID, title, predicates, or private ownership fields.

## Findings and remediation

All five findings below were corrected during implementation. None exposed an economic mutation
or cross-account execution path in the reviewed Phase 0 surface.

| ID | Severity and prerequisite | Finding, correction and retest |
| --- | --- | --- |
| COORD-001 | Low; a trusted JavaScript caller supplies an array with a custom prototype. HTTP JSON cannot represent this shape. | The compiler validated an array's own properties before using inherited `.map`, allowing caller-provided executable prototype behavior at a data-only boundary. `array()` now requires `Array.prototype`. Compiler regressions cover node arrays and nested rule arrays with hostile inherited methods and prove refusal before those methods execute. |
| COORD-002 | Low; a trusted source declares version `2147483648` or higher. | The compiler accepted safe JavaScript integer versions beyond PostgreSQL `INTEGER`, so a compiler-valid definition could fail on persistence. Versions are now bounded to `2147483647`. Regressions accept that maximum and refuse the next integer before any database action. |
| COORD-003 | Low; the original account cancels a run after its character dies. | The event writer used the historical owner character as the actor, attributing cancellation to a dead character. Events now receive the actual current actor character, or null when no living character exists. The historical owner tuple remains unchanged. Integration and PostgreSQL probes check an heir's cancellation against the retained original owner. |
| COORD-004 | Low; creation overlaps a committing death/heir transaction in PostgreSQL. | A living-character `SELECT ... FOR UPDATE` could wait on the dying row and return no result because the new heir was outside that statement's snapshot. The initial real-PostgreSQL probe reproduced `coordination_unavailable` with a committed living heir. The runtime now repeats the lookup when the locked first query returns no character, matching the established game wrapper. The same blocked-query sequence then created the heir's run successfully. |
| COORD-005 | Low; the domain command commits but the outer HTTP receipt-store UPDATE fails. Found by the implementing agent and cross-checked by the reviewer. | The global HTTP hook retained `status=0` and returned `in_progress` before the coordination handler could recover its durable receipt. A private per-server Symbol now marks only the three coordination mutation routes. After checking the unchanged HTTP body hash, those routes may enter their account-locked domain handler and repair the outer receipt. The API fault regression injects the failed store, proves exact recovery, and forces two simultaneous pending-key readers to produce one transition and one replay. A different body remains 422; an ordinary bank route remains 409 even with a forged coordination header. |

The first PostgreSQL integration attempt also found a test-only representation mismatch:
`COUNT(*)` returned string `"0"` while the assertion expected numeric `0`. This was a harness issue,
not a runtime failure. The assertion now normalizes the count with `Number`, and the unchanged
runtime passed the full PostgreSQL integration suite afterward.

## Executed evidence

Runtime: Node.js `v24.19.0`; database probes: PostgreSQL `18.4` on Windows. The reviewer initialized
an isolated cluster under `tmp/coordination-review/pgdata`, listening only on `127.0.0.1:55483`.
The fixed scratch user was `coordination_review`. No live `DATABASE_URL` was read or used. The
integration runner accepts only an explicit loopback `COORDINATION_TEST_DATABASE_URL` and uses a
fresh random schema, removed after the run.

| Check | Evidence |
| --- | --- |
| `node test/coordination-graph.js` | Passed. Deep immutability, branded registry, canonical property/node/predicate ordering, every three-condition M-of-N truth table, missing/invalid state, unknown OR branches, hostile schemas, hidden discovery dependencies, duplicate IDs, dangling references, cycles, disconnected branches, 64-node/8-depth/512-rule bounds, custom array prototypes, and version INTEGER boundaries. |
| `node test/coordination.js` | Passed on pg-mem. Complete pilot journey, private projections, replay and key reuse, concurrent stale actions, pinned versions, retirement recovery, death/replacement ownership, server-derived level/location/time, zero economic changes, ten definitive rollback boundaries, and lost-COMMIT receipt recovery. |
| `COORDINATION_TEST_DATABASE_URL=postgresql://coordination_review@127.0.0.1:55483/postgres node test/coordination.js --postgres` | Passed on isolated PostgreSQL 18.4 after the COUNT assertion correction. Full schema applied twice; all integration cases, ten rollback boundaries and ambiguous-commit receipt recovery passed. The runner dropped its random test schema in `finally`. |
| `node test/coordination-api.js` | Passed with `DATABASE_URL` explicitly empty in the test process. Strict request validation, authentication, private response schemas, OpenAPI, cohort restrictions, foreign/nonexistent privacy, transport/domain replay, agent cadence, stopped-rollout recovery, failed outer receipt storage and simultaneous pending-key retries passed. This is focused HTTP evidence, not a complete review of all shared authentication code. |
| `node --check src/coordination/{graph,runtime,pilot}.js` (one command per file) | Passed with no diagnostics. |
| Scoped `git diff --check` | Passed with no whitespace diagnostics. |
| `node tmp/coordination-review/probes.mjs` | Passed on PostgreSQL 18.4 after remediation. Concurrent creates converged on one instance; concurrent actions at one revision produced one success and one stale refusal; an event-insert failure restored progress and receipt state; the real death/heir lock interleaving completed successfully; old-character advancement refused; original-account historical cancellation and disabled receipt replay succeeded; oversized definition versions refused. |

The scratch PostgreSQL probe's final output was:

```text
PASS PostgreSQL: concurrent creates converge and same-revision commands serialize
PASS PostgreSQL: event insert failure rolls progress and receipts back
OBSERVED death-race create: {"ok":true}
OBSERVED post-death cancellation actor: review-heir actual living character: review-heir
PASS historical owner cannot act; original account can cancel; disabled service replays receipt only
PASS oversized persisted INTEGER version rejected by compiler
```

The official integration outputs were:

```text
coordination: pg-mem journey, visibility, replay, races, pins, historical recovery, zero-value and 10 rollback boundaries pass
coordination: PostgreSQL journey, visibility, replay, races, pins, historical recovery, zero-value and 10 rollback boundaries pass
```

The HTTP regression emitted the intentionally injected failure and then passed:

```text
[db] pg-mem in-memory database (set DATABASE_URL for Postgres)
idempotency: store UPDATE failed — key left in-progress, value may have committed injected lost HTTP receipt-store acknowledgement
coordination API: strict inputs, auth, safe projections, OpenAPI, cohort, replay, privacy, and stopped-rollout recovery passed
```

All commands in the completed evidence rows exited 0. Native syntax checks emitted no diagnostics.
The whitespace check emitted only Git's informational LF-to-CRLF working-copy notice for
`schema.sql`, with no whitespace errors. The initial PostgreSQL COUNT assertion attempt exited 1;
it is retained above as a corrected harness failure rather than omitted from the record.

The reproducible death-race schedule is: hold the old character row in a transaction; mark it dead
and insert an heir without committing; start a coordination create from another connection; wait
until its character query is dispatched; commit the death transaction; assert create succeeds for
the heir. This is a real PostgreSQL row-lock probe, not an in-memory approximation.

## Static triage and limits

ContextPlus structural discovery and file skeletons worked. A `run_static_analysis` tool was not
exposed and Semgrep was not on PATH. Native syntax checks and focused query/mutation searches were
used; this report does not claim a clean result from a static-analysis tool that did not run.

The reviewed runtime's writes target only `coordination_definitions`, `coordination_instances`,
`coordination_events`, and `coordination_commands`. Exact searches found no `eval`, `new Function`,
HTTP `fetch`, ledger call, or `withCharacter` invocation in the new coordination modules. The
rollback-only DELETEs are pg-mem compensation, not gameplay history erasure. Parameterized SQL and
closed compiler schemas were inspected at their actual call sites. Importing `GameError` and
`levelOf` does not invoke economic mutations.

Two suspected issues were examined without establishing an exploit: replay after disable returns
a historical receipt, but every new act rechecks the rollout and current authority; a definition
insert using `ON CONFLICT DO NOTHING` registers an inverse, but real PostgreSQL uses transaction
rollback and pg-mem serializes participating writers, so the inverse does not delete a competing
committed definition in the supported path.

This review does not prove resilience against a privileged actor directly rewriting SQL rows.
Definitions/events are append-only through the reviewed service; no new PostgreSQL trigger prevents
an administrator from updating them. Persisted definitions are recompiled and hash-checked on use.
Command-receipt retention and growth have not been load-tested. The pg-mem barrier coordinates
participating Phase 2/coordination operations, not every legacy game mutation; PostgreSQL supplies
the production cross-system row locks. The focused API regressions cover its HTTP boundary and
transport recovery, but the entire shared auth/session middleware, HTTP framework and OpenAPI
implementation are not independently cleared by this review.

Broader checks are not cleared by the focused results above. The implementing agent reported two
standalone failures outside this feature: `test/docs.js` reached its O1 audit-packet check and found
missing scope entries for eleven preexisting, untracked market-v2 contracts; `test/gates.js` passed
its gate matrix and then failed its existing `bondQuoteBudgetAmount` price-bound classification
check. The reported bond source and gate test were unchanged from HEAD. Their retained outputs and
the final broad-run status belong to the implementing agent's evidence; this review does not
reclassify them as coordination defects or change the financial code to force those checks green.

The isolated PostgreSQL server was stopped after its successful runs. Automatic command review
refused recursive deletion of the verified, literal `tmp/coordination-review` directory with the
reason `blocked by policy`; no alternate deletion mechanism was used. The scratch directory remains
local and the implementing agent added an exact `/tmp/coordination-review/` ignore entry so database
files cannot enter the change by ordinary staging. The separate `tmp/coordination-full-test.log`
was left untouched. Durable text evidence and the isolated proof script are retained under
[evidence](evidence/), outside the scratch database.

No unresolved high or critical finding was established in this bounded review. This is internal
Phase 0 evidence, not a production activation recommendation or a declaration that no defects remain.

## Final working-source pin and completion record

The final working-tree pin is [evidence/SOURCE_MANIFEST.json](evidence/SOURCE_MANIFEST.json), SHA-256:
`f46232f2ec2b73eeddb970f79466a5dfaca4ca0aeb61edc13790e80fc1bdd816`.

It covers the coordination graph/runtime/pilot/routes, schema, gateway/server integration,
preflight configuration, package scripts, three focused test files, and the exact scratch-directory
ignore entry. It also hashes the inspected canonicalization, transaction, database, error,
character/rule/authentication and death/replacement dependencies; hashing those dependencies does
not claim a whole-module security review of them. The baseline and dirty-tree status are included.

All focused compiler, pg-mem, PostgreSQL and API evidence above passed before this pin. The later
HTTP recovery correction did not change the graph/runtime/schema files exercised by PostgreSQL.
The broad application suite has separate unresolved results described above. A source hash
mismatch requires retesting its affected boundary before reusing this internal Phase 0 conclusion.
