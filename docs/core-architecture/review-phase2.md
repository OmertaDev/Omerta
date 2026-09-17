# Phase 2 coordination boundary review

Reviewed 2026-09-17 in the dirty `Omerta-coordination` worktree, based on commit `72235ae5bae5e9f8605b2bd9c087d8922d87b27f`. This is bounded implementation/review evidence, not a phase-pass or deployment declaration. `COORDINATION_OPERATIONS` and `WORLD_GRAPH_KERNEL` remain default-off. The root integrator owns final runtime, schema, API, invariant, native database and full-suite acceptance.

## Scope and methods

This reviewer traced the legacy operation read/mutation/recovery entrypoints and their item replay/custody callees; implemented their mode barriers; authored the Family definition compiler and pilot; and reviewed the corresponding regression and extraction changes below. Family runtime was inspected only at those shared boundaries, definition consumption and proof preparation. Cash settlement, the complete runtime state machine, frontend, contracts, token rails and production infrastructure are outside this reviewer's independent conclusion.

Methods continue the exact locally verified pins and targeted sources recorded in [Phase 1 review](review-phase1.md#scope-and-methods), under [SECURITY-REVIEW-POLICY.md](../../omerta-contracts/SECURITY-REVIEW-POLICY.md): Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd` access-control/invariant passes; Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` depth-state-trace; Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc` audit-context-building and fp-check. Adaptation: targeted JavaScript source-to-state traces and executable regressions, not upstream Solidity orchestration or a claimed clean static-analyzer run. The AST changes below concern repository evidence extraction, not a general vulnerability scanner.

## Resolved hazards and checked properties

- **P2-MODE-01 — legacy deputy/recovery boundary, resolved.** `cancelOperation → cancellationAuthority → lockedCancellationAuthority → releaseAllEscrow → setStatus` deliberately tolerates unavailable historical graph definitions. Before mode isolation, a Family row with a legacy-compatible lifecycle could reach item-only recovery without Family cash/readiness rules. Final schema lifecycle checks reduce status overlap but do not supply the required read/replay/mode boundary. `operationRow` now filters `coordination_mode='crew'` before an operation lock; mode participates in cancellation authority identity. Separate open and discovery queries also filter mode, and Crew creation inserts it explicitly.
- **P2-MODE-02 — completed receipt bypass, resolved.** Item replay returns before the fresh mutation callback. `destinationsFor` therefore rejects non-Crew rows before replay lookup for assign/contribute/complete; cancellation has its own pre-replay authority rejection. Matching graph, opener, Crew membership and assigned role grant no legacy access to a Family row. Tests seed exact completed legacy receipts deliberately and verify denial with escrow, operation state and event/guard tables unchanged. HTTP board/role reads and discovery also hide these rows; opening the same graph tuple creates a distinct Crew operation.
- **P2-DEF-01 — pinned, bounded declarative input, checked.** The compiler rejects undeclared fields, executable/accessor values, object coercion, malformed prototypes, sparse/decorated arrays, duplicate identities, invalid references and integer overflow. It returns detached deeply frozen definitions. SHA-256 covers normalized definition data plus the selected compiled world definition hash. Versions fit PostgreSQL `INT`; lifetime is 60–604800 seconds. There are 2–8 distinct single-seat roles, at most eight requirements per role and 32 total. The one primary item must match the selected world action exactly; all resource quantities aggregate to exactly its material vector, with no missing or extra consumption.
- **P2-PROOF-01 — combined knowledge budget, resolved.** Role information predicates plus the executor's world predicates must fit the proof preparer's global 32-requirement and per-actor 16-requirement bounds. Regression accepts 30 authored facts plus two world predicates and rejects a third. Knowledge requirements use the existing exact-source normalizer. Capability/resolution skills are restricted to actual `muscle`, `cunning`, `speed` columns and existing `levelOf(respect)`; no dynamic SQL identifier is accepted.
- **P2-DEF-02 — compiler/storage width mismatch, resolved.** The graph reviewer identified that generic 128-character IDs exceeded the existing 80-character role column check, while combined `roleId/requirementId` could exceed the 200-character contribution-node check. The compiler now enforces both storage limits before runtime. Regression accepts the exact 80/200 boundaries and rejects 81-character roles and 201-character contribution keys.
- **P2-EVIDENCE-01 — route/invariant evidence integration, resolved.** Cold-start tests require exact default-off 404/error-code refusals for three kernel boards and the Family catalog. Knowledge extraction recognizes the actual wrapper AST, bound validator and idempotency-header rejection; negative regressions remove auth, change the header, disconnect the validator and use another file. It now requires all 26 world-graph routes/15 mutations and all four Family routes. Invariant taxonomy distinguishes Family history/custody and world transitions from the imported BigInt cash reconciliation helper; its dynamic ledger reasons remain an explicit parser limitation. The stale root provenance edge expectation now matches the pre-existing `serveLaunchPage` source and neighboring assertion.

## Independent shared-boundary review supplied by the graph reviewer

The graph reviewer inspected grouped authentic knowledge proofs and in-transaction world execution. Reported resolved findings: canonical hashing of Date-bearing database rows replaced with scalar identities; execute readiness now takes exclusive `FOR UPDATE NOWAIT` instead of upgrading a shared world lock; post-commit hint exceptions are contained; escrow-release argument order is corrected; combined proof limits are enforced above.

That reviewer reports `test/coordination-knowledge-proof.js` and `test/world-kernel-transaction.js` passing on pg-mem and PostgreSQL 16, and `test/family-operation-concurrency.js` passing on PostgreSQL 16 after the replay repair. The native race uses an original depositor retained only in refunded capital history, actual `withCharacter + acceptInvite` versus coordinator cancel in both orders, observed database waiting, complete losing rollback, and disjoint Families competing for one world row with one winning event and conserved refunds. The historical-depositor union can form a Crew/character lock cycle; native NOWAIT handles contention. The analogous standalone current-roster invite hypothesis was rejected because `acceptInvite` rejects `in_crew` before locking the target Crew; standalone blocking behavior remains unchanged.

These are attributed reviewer results, not native tests rerun by this reviewer. Their source is the named regression files and retained agent tool outputs. A root repair for same-key execution with stale pre-Crew snapshots has landed; final integration replay/rollback acceptance remains the root's task. Later runtime/invariant edits are not silently covered by this manifest.

The graph reviewer subsequently retained the passing PostgreSQL 16 rerun at `../evidence/family-operation-concurrency-pg16.log`, including exact source hashes. It also checks healthy live/canceled/completed histories and detects isolated revision, contribution-character and held-capital corruption before restoring healthy audits. That reviewer's full pg-mem Family integration run passed at `../evidence/family-operation-invariant-integration-memory.log`. The indexed invariant implementation preserves checks while avoiding repeated full-row scans. These attributed runs cover runtime hash `a1742a4c0c41f7e02a352a4bf3bffa8ad975daa3849c782341f264d05e0bc7c0`, invariant hash `b0d8116a2e67db0909e8231d599db409c3f5e05c0dc1ecfd01cf29ee36b3f3b6` and native test hash `efa89729522e6af8c635b3945b6ac71a4985ed466d637903f908450a7dd2c641`; they do not cover later edits automatically.

## Executed evidence and limits

Node `v24.19.0`; commands executed in this isolated worktree on 2026-09-17:

| Command | Observed outcome |
| --- | --- |
| `node test/coordination-mode-boundary.js` | PASS: service/HTTP reads, mutation and exact receipt rejection, escrow preservation, discovery/open separation. |
| `node test/coordination-operation-definitions.js` | PASS: closed data, dependency pinning, exact custody/material requirements, limits and skill behavior. |
| `node test/operations.js` | PASS after two SQL trace predicates were updated to require the mode filter; the same lock-order assertions remain. |
| `node test/worldgraph-api.js` | PASS: existing authority, replay, privacy and economy contract. |
| `node test/coldstart.js` | PASS: 175 answering routes and ten declared refusals, including the four exact default-off checks. |
| `node test/graph.js` | PASS, including currency/noncurrency classification and extractor honesty assertions. |
| `node tools/knowledge-test.js` | New guard/route/provenance and checkout-stability checks PASS; suite stops at generated `graph.json` source-revision drift. Raw output: `../evidence/phase2-knowledge-security-test.log`. Generated artifacts were not edited. |

Syntax checks and `git diff --check` passed. These unit/integration results are point-in-time evidence; pg-mem does not prove PostgreSQL locking. This review introduces no additional unresolved confirmed defect in its own bounded source below. It does not conclude that the concurrently evolving full runtime, all remaining knowledge-artifact checks or the full repository suite pass.

## Reviewed working-tree hashes

SHA-256 captured 2026-09-17 16:42 America/New_York; compiler and compiler-test entries refreshed at 16:44 after the storage-width fix and passing retest. Material changes reopen the affected conclusion.

```text
src/operations.js 77fe4f99fbf38231d9475f87824843616dff991f7eef461774a1286f55d238e7
src/routes/worldgraph.js 4298f0ff4a7d16d6169e71624174e36c3b1a1a39edb20ff5d4e42a798110e6f9
src/coordination/operation-definitions.js ab2449e51bf83ada43f112e1ddec279edff5777703d0cbccd22da28994e1db61
src/content/coordination-operation-pilot.js 77e96741b2b2f194b9b71bcf80f096153a9ee782ef6e5809f3534196031fe6ef
test/coordination-mode-boundary.js e29c194c3322f57e7a00c805ef5b78f0f2e42f9c7ad76fe2fed7c5aecde1ff50
test/coordination-operation-definitions.js 798d98b472fcd1111ecaad735171a73cd30d8e1b02509053571888d9897ef8b8
test/operations.js 57f0635df58c611d0c626559af5812a390426ad82d2f0a024cf09476c3a0a4ed
test/coldstart.js 71192f6cd3439fc8c1edf01c30bb0ef33c335a7209f0d1848f120688423df5dc
test/graph.js c000ac2881d0f82677e1a661bdbcf41828b5062bbd0000984f29873c54464026
tools/knowledge.js eae5829968faa7d546c725b55c5ff494e1d6ad648965837efa2704f5aa815d57
tools/knowledge-test.js ec478ef321047d6559575697f121fec7ae2fbcdf26ad7a88ac755fa234149b69
```

## Final SQL-call addendum — 2026-09-17 16:48 America/New_York

Reviewed only the four mechanical query-call rewrites in `src/coordination/operations.js`: operation lookup, sorted character acquisition, sorted account acquisition and world readiness. Moving conditionals outside `client.query` preserves each SQL string, bound ID, branch condition and sequential await. Operation lookup still filters Family mode before an optional `FOR UPDATE`; native characters retain `FOR UPDATE NOWAIT`, native accounts retain `FOR SHARE NOWAIT`, and pg-mem retains their blocking counterparts. Execute readiness still takes `FOR UPDATE NOWAIT` natively or `FOR UPDATE` in memory; ordinary reads retain `FOR SHARE`. No authority, lock order, replay or transaction behavior changed in this delta.

The updated runtime SHA-256 is `e9accb924ed3381c0b72a6ece6a3122d9998bdd38899e89b2a6614bcf91ff039`, superseding the earlier attributed runtime hash only. The root integrator's assembled lanes passed; this reviewer inspected their retained outputs rather than repeating them:

| Retained root evidence | Coverage and SHA-256 |
| --- | --- |
| `../evidence/family-operations-memory-gate.log` | Eight suites: definitions, legacy mode boundary, capital, materials, grouped proof, in-transaction world execution, complete Family lifecycle/replay/restart and mounted HTTP policy/lost-receipt recovery. `d75929063ad40a26310c6906889427649970e049f31b2a5e6354d000200b374c` |
| `../evidence/family-operations-native-gate.log` | Seven PostgreSQL suites: capital, materials, proof, shared transaction, full lifecycle/replay, populated Phase 1 migration/repeated boot/constraints, and both-order membership/world-contention races. `834d9cc3707a9ec29ac7a06ff3b3406c3e62883c1a9c1ead7e5f37aa46cb3356` |

The root also reports all 3876 extracted SQL preparations passing, with 38 nonliteral sites unchanged from Phase 1. The existing interpolation diagnostic remains 185 against the original 183 baseline and unchanged ceiling of 168; no threshold was raised. This addendum does not turn that known static-gate failure, generated knowledge drift or other unrelated baseline failures into passing results. Final syntax/docs/preflight and phase acceptance remain with the root integrator.
