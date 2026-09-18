# Architecture closure evidence

Scope: repository release-gate closure for the player command milestone, beginning at
`bca01026b642a2632cc9476e8a664287eac281ea`. This is source and isolated verification evidence,
not deployment approval or an audit of the unrelated financial contracts.

## Checkpoint and handoff

The checkpoint is the generated-knowledge commit immediately after final Phase 5 source
`238c9b8476c5351776f3e6e22073dbb0f8c639e9`. Its architecture baseline is
`e56cf576065c5f1bbb9bb55115f5961267f7d654`; the range contains 16 commits. The engineering
handoff at `outputs/ENGINEERING-HANDOFF.md` in the imported 2026-09-17 task bundle has SHA-256
`2517f911c3c3e97c2ffa083f3904b811d493c9316e99fd38d1bb211e8f875e2d`.

The exact checkpoint was also available in the clean imported `work/Omerta` checkout. A fresh
PostgreSQL 16 run from that unchanged checkout independently reproduced **203 passed, 0 failed**.
Evidence: `output/player-command-engine/checkpoint-bca-pgcheck-configured.log` and `.exit`.
The earlier attempt stopped at deploy preflight because the scratch process lacked explicit
`MARKET_SEED` and `SOCIAL_VERIFY_MODE`; the retained failure is a harness configuration error,
not a failed domain check. The configured rerun used only disposable local PostgreSQL.

| Phase | State at bca01026 | Boundaries |
| --- | --- | --- |
| 1 World Graph | Component complete | Pinned objects, existing-authority references, atomic mutation/events, replay, inventory provenance and visibility |
| 2 Coordination | Component complete | Current Crew/Family seats, real commitments/escrow, readiness, resolution/refunds and persistent outcomes |
| 3 Projection | Component complete | Bounded authorized read facade, coherent snapshots, player differences and private refresh hints |
| 4 Progression | Component complete | Shared prerequisites, secret/partial/known recipes, scarcity, bounded content admission, both persistent Furnace Ledger branches |
| 5 Hardening/UX | Complete within declared bounded scope | Earned clue/case text, server-issued actions, confirmation, reload-safe retries, character-scoped selection, eligible public consequence hints and indexed operation reads |

The opening status list in `IMPLEMENTATION.md` was stale: it still called Phase 4 partial and
Phase 5 unstarted despite its own later sections, both scoped reviews, and the final handoff.
That opening list is now corrected. Historic review claims and their limits remain intact.
Phase 5 did not promise a broad gameplay migration, a general command center, or durable
cross-process invalidation; those are follow-up scope, not missing implementations concealed as passes.

## Failure provenance

The clean original repository remains at `e56cf576`. Both reported main-chain failures were
freshly reproduced there and at `bca01026` before closure changes. The logs are
`baseline-routes.log`, `baseline-gates.log`, `checkpoint-routes.log` and `checkpoint-gates.log`
under `output/player-command-engine/`, each with an exit-status sidecar.

1. **Routes, pre-existing:** the research-sheet test expected retired OMR graphics on the
   homepage and wiki. Its subsequent assertions also expected retired OHM-model copy and
   two replaced campaign films. The baseline already shipped the current copy and three
   current films. The test now names the actual intended surfaces; exact image sets and
   current content hashes, responsive posters, deferred sources, compression, authentication,
   and byte-range streaming remain asserted. No production copy was reverted to obsolete claims.
2. **Repository gates, partly pre-existing:** the first failure was the pure upward-rounded
   `bondQuoteBudgetAmount` price-wall classification. The historical baseline diagnostic and
   unchanged baseline source also establish the two `defi.js` prototype-membership checks,
   unclassified viem-only concurrency, compiler discriminator display metadata, knowledge SQL
   declarations, dormant current-copy/market suites, and local cache/capability postures.
   The actual membership checks now use `Object.hasOwn`; live inherited-key refusals are tested.
   Exact source-backed declarations classify RPC-only concurrency and private compiler/capability
   objects without allowing shared PostgreSQL concurrency or authorizing player input.

The handoff's phrase "same two baseline failures" describes the two stopping main-chain
commands; it does **not** prove every assertion later in those commands predated the work.
Continuing the real gate uncovered architecture-attributable integration omissions at bca01026:

- Private Family prerequisite `subjectKey` had no display-payload classification.
- `core-progression-api.js` and `progression-admission.js` were not reached by the suite ledger.
- The exact native CI inventory omitted the already invoked core-progression native gate.
- `requirementBatches` shared a multi-declarator statement which the module-state census did
  not discover, although its capability posture was declared. Its declaration is now separate.

These are corrected rather than classified as baseline. No gate assertion, anti-vacuity floor,
authorization check, SQL ceiling, or production limit was weakened.

The three dormant Market V2 suites require real Foundry build artifacts. They now have
`npm run test:market-v2` in the existing Forge workflow after its build, with source/test/script
path triggers. The existing all-workflow suite census recognizes that invocation. They are
not exempted or silently skipped in the memory suite. Initial local missing-artifact errors
are retained separately from the artifact-backed rerun.

## SQL guard

Fresh scans of the actual source trees give:

| Source | Interpolated statements | Nonliteral calls | Interpolation ceiling |
| --- | ---: | ---: | ---: |
| e56cf576 baseline | 183 | 38 | 168 |
| bca01026 checkpoint | 189 | 38 | 168 |
| Closure | 168 | 38 | 168 |

Evidence: `sql-count-comparison.json`. The failure therefore **predated** the architecture,
and the architecture increased its count by six. The raw unchanged ceiling is retained in
`tools/pgquery.js`.

Twenty-one interpolated statements became statically preparable through scalar parameter
binding, explicit fixed SQL branches, and a fixed-schema rollback insert. Changes preserve
row locks, predicates, bounded limits, timestamps, selected columns and transaction ownership.
Knowledge pagination now also binds its limit sentinel. The ballot regression still plants
row 101 and demands fail-closed behavior; it now verifies the exact bound value 101 rather
than requiring that safe value to appear as interpolated SQL text.

Remaining dynamic knowledge-helper SQL is classified narrowly: table names and row keys
come from module-local literal call sites and fixed event schemas; account/membership/text
values are bound. Visibility fragments use literal aliases and numbered scalar placeholders.
No array-to-ANY query, unsafe string concatenation, or hidden scan was introduced.

The first closure native preparation run passed **3,991 static statements**, with **168**
interpolated and **38** nonliteral sites. Later command-engine source changes require their
own final preparation result; this count is not a promise about files changed afterward.

The final preparation rerun after command backend integration passed **3,992 static
statements**, with the same **168** interpolated and **38** nonliteral sites. The final
full-server PostgreSQL verification also passed **203/0**. Evidence:
`final-pgquery.log/.exit` and `final-pgcheck.log/.exit`.

## Bounded command execution review

An independent source pass followed `src/routes/commands.js`, `src/player-commands.js`,
`src/player-opportunities.js`, the generic HTTP idempotency hooks, projection hints and the
existing domain adapters. Exact working-file hashes for this pass and the closure fixes are
retained in `output/player-command-engine/closure-source-manifest.json` (22 files).

- Client execution accepts only an issued execution identity and confirmation. Issued boards
  are selected by both board ID and authenticated account, then matched to the current living
  character. Client-authored targets, prerequisites, costs and authority do not enter dispatch.
- The execution identity derives the durable existing domain key. Concurrent requests reach
  the established locks/receipts. HTTP's source-branded command configuration deliberately
  reenters the live handler even for completed HTTP receipts; it never replays a cached private
  projection after permission changes. Body-hash conflict checking remains active.
- Domain mutation paths retain current membership, knowledge, resource, version and character
  checks under their existing transaction boundaries. The pre-dispatch board fingerprint is an
  additional stale-view check, not a replacement for those locks. Mystery ownership is pinned
  to the original character and resolves a living locked actor.
- Read, blocker, opportunity and consequence responses are built from authorized projections.
  Unknown prerequisite kinds collapse to a generic undiscovered requirement. Raw domain
  receipts and domain error details are not returned as consequence payloads. Successful
  effects followed by projection failure request reconciliation using the same identity.
- Crew/Family sharing uses a server-issued sealed target from a branded, locked knowledge
  context and rechecks the expected group. It continues through the existing knowledge ACL
  revision protocol rather than a new mutation framework.

No concrete high-severity authorization or duplicate-effect bypass was found in this bounded
pass. This is not a substitute for the milestone's native adversarial tests. The persistent
command-board history needs an explicit retention policy that preserves retry linkage;
opportunity expiry alone does not garbage-collect issued boards. Process-local hints remain
best-effort. No Solidity callback, transfer, or signing behavior changed in this review scope.

## Verification and remaining limits

The initial closure run passed all eight registered World Kernel, Family operation, World
Projection, and Core Progression scripts (memory and PostgreSQL). Logs are named
`checkpoint-test-*.log`; despite the historical filename, native lanes ran while closure
edits were being integrated and are evidence for those working files, not an immutable final
milestone source stamp. Both persistent Furnace branches passed. The final milestone reruns
the affected native lanes after command integration.

That final rerun is complete: all five native scripts pass (`test:coordination:postgres`,
`test:world-kernel:postgres`, `test:family-operations:postgres`,
`test:world-projections:postgres`, `test:core-progression:postgres`). Logs and exit-status
sidecars use the `final-test-` prefix. The preserve and expose Furnace branches, populated
repeated migrations, query/read boundaries, locked concurrency, rollback and durable replay
all remain passing after command integration. No architecture component was rebuilt.

Affected memory regressions passed: knowledge graph/runtime/API, Coordination/API, ballot
(after updating its bound-value assertion), commission, store, prison, collision, social,
port, content crafting jobs/tools and current copy. `test/routes.js` and the complete
`test/gates.js` both pass after the corrections above. The parent milestone retains the
full pretest/main-chain execution and command security/vertical-slice results separately.

The three Market V2 suites now pass against a real local Foundry build: 15 deployment-plan
checks plus keeper and solver suites (`closure-market-v2-contained-retest.log/.exit`). The
first build used identical dependency files through a junction; the artifact verifier correctly
rejected sources resolving outside the contracts root. Copying those same dependency files
inside the task checkout satisfied source containment without changing that safeguard.
`closure-forge-build.log/.exit` retains the successful compiler run and its existing lint
warnings; no clean financial-contract lint or audit result is claimed.

Final closure static checks pass: the complete repository gate, 29 changed/new JavaScript
syntax checks, and development preflight/content admission. `final-gates`, `final-syntax`,
and `final-preflight` logs/exit files retain results. Development preflight is explicitly not
a production configuration approval.

The full repository continuation also exposed a **new cold-start gate integration failure**:
`test/coldstart.js` explicitly disables the World Graph pilot, but had not classified the new
`/v1/commands` route's intentionally opaque refusal. The route is now declared with the exact
expected HTTP 409 / `command_unavailable` contract; all other disabled pilot routes retain
their HTTP 404 assertions, and stale declarations still fail. The standalone rerun passes
176 ordinary parameterless GETs and 12 declared refusals. The enabled command API fixture
separately checks HTTP 200 for a living player without seeded gameplay history. This is a
milestone integration fix, not a baseline application failure. Evidence:
`full-suite/test_coldstart_js.log`, `coldstart-standalone-retest.log/.exit`.

The concurrent full-suite run also recorded an Agent Alpha child-mutation timeout in
`full-suite/test_agent-alpha_js.log`. An unchanged standalone rerun passes all Agent Alpha
fixtures, including hard-crash durable replay, without changing the test, runner, permission
checks or 8-second child wait (`agent-alpha-standalone-retest.log/.exit`, exit 0). Both the
test and runner are unchanged between `e56cf576` and `bca01026`, but the failed run was not
reproduced at either historical revision, so this is **a recovered verification-run failure,
not a proven baseline failure**. Concurrent workload contention is a possible explanation,
not an established root cause. The original failed-run log remains retained.

Node is v24.19.0; the isolated database is PostgreSQL 16, listening only on loopback port
55437 with task-owned data under `output/player-command-engine/postgres16-data`. No existing
database/service, production configuration, signer, token rail or deployment was changed.
Foundry artifacts use forge 1.7.1 and the repository's solc 0.8.26 configuration; they do not
constitute a fresh financial-contract audit. The JavaScript package has no separate TypeScript
or lint command; syntax/static/runtime checks must be named rather than called fictitious
type/lint passes.

Checkpoint debt that remains outside this closure: best-effort process-local refresh hints
without a durable outbox; broader acquisition/sharing navigation before the command milestone;
quota/history retention and content replacement/rollover policies; representative staging
backup/restore and compatible rollback rehearsal; no general content importer or cross-lot
custody bridge. Feature flags remain off by default pending release acceptance.
