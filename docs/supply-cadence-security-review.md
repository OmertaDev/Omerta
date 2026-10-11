# Game supply cadence release review

Date: 2026-10-11. Phase: pre-release; financial activation disabled. Reviewed runtime source: 30b2e4ddacfb1970c7e8a3e96167fe5d8b96dc32, preceded by helper commit 4ebd3ce3. Main integrated in cd3b1f348922f9352e580b4e8998e90b77725fa4. The release-preparation changes add explicit test discovery, measured census and this evidence; they do not change reviewed runtime code. Independent reviewer game_courier reported no findings for the final canonical restock integration. Exact-head hosted checks and deployment verification remain separate requirements.

## Scope and model

Included: src/supplycontracts.js, src/depot.js canonical automated restock integration, src/depotcontracts.js, src/routes/depot.js, the business_supply_contracts schema and the two supply test suites. Existing operating-policy, game-character transaction and procurement accounting are dependencies. External payment, compute, withdrawal, chain execution and automatic background scheduling are excluded. This is bounded in-game cash procurement cadence, not an external supply purchase or claim of real earnings.

An owner session may approve or revise a cadence for an owned open depot. Enabling requires the current live procurement policy and matching depot terms. Bounds are 3600–604800 seconds for interval and expiry and 1–100 cycles. Optimistic revision plus depot/policy/cadence locks protect changes and dispatch. An enabled cadence binds the specific policy identity; reauthorization requires an explicit cadence revision. Expired, exhausted or not-yet-due cadence blocks delegated procurement. No enabled cadence preserves the existing delegated policy behavior. Manual owner restocking remains available independently of optional cadence exhaustion.

The canonical restock path checks policy and due cadence before creating a funded procurement order. It records a cycle only after actual order escrow/fee accounting and policy spending, in that same transaction. Order, escrow, spending and cycle updates roll back together. Cancellation/refunds do not replenish procurement authority or consumed cycles. The next due time advances from actual dispatch time; there is no backlog replay or automatic catch-up. Cadence observations and quotes confer no spending authority.

## Review methods and findings

Relevant methods follow omerta-contracts/SECURITY-REVIEW-POLICY.md pins: Pashov c577eb7799c349de0acb187ba00ca98e14e436fd authorization/replay/boundary passes; Plamen 795962b96e254f2e423a2635fe7f8cb8ea1e6d69 accounting/state-transition review adapted to JavaScript/PostgreSQL; Trail of Bits d3323cefbcf645678b8dc481de204b02ad3d02dc context/specification and property/rollback checks. These are adapted agent passes, not claims of upstream orchestration or whole-repository automated SAST. Solidity callbacks and blockchain settlement are inapplicable to these database routes.

The helper and final restock integration were independently reviewed with no findings. Native harness setup failures were corrected before the passing proof: missing disposable fixture keys, a pool callback wrapper incompatibility and a repeated fixture-name collision. These were failed test attempts, not passing evidence or production fixes. The final proof is scoped to the exact source above; it does not certify unrelated depot behavior or external finance.

## Executed evidence

Root retained output/supply-native-proof.json at SHA256 f879f688e921d20ad477ff97be3c4d15f3faabcb2b80ecd3924dd33d3974b8c9. Its source is 30b2e4ddacfb1970c7e8a3e96167fe5d8b96dc32; financialActivation is disabled. The following is the retained proof summary, not a claim that release preparation reran the native fixture:

| Command or proof | Outcome and scope |
|---|---|
| node test/supplycontracts.js | Exit 0; cadence bounds, exact revision, policy binding, replay and real-order requirements |
| node test/supplycontracts-api.js | Exit 0 in memory; authenticated owner control, due cycles, expiry/policy drift, refund/spend conservation and manual authority |
| node test/operatingpolicy.js | Exit 0; existing owner policy behavior retained |
| node test/supplycontracts-api.js --postgres | Exit 0 in dedicated disposable game_supply_20261011, PostgreSQL 18.4 as reported by the root coordinator; one successful dispatch from two concurrent attempts and atomic rollback on injected cycle-persistence failure |

The native test asserts rollback of depot treasury, procurement order count, policy spent and cadence dispatched together, using actual HTTP handlers and database transactions. It also exercises the authority, expiry, revision, policy-drift and preserved manual behavior checks. Memory tests establish functional behavior; the concurrent dispatch and transaction rollback conclusions specifically depend on the native proof.

Release preparation explicitly invokes both supply suites in pretest, preserving existing scripts and safeguards. The unchanged documentation and suite-inventory gates are run against the combined source. After a clean authored commit, generated knowledge is rebuilt and validated before publishing; required hosted checks remain pending until their exact-head result exists.

Release-preparation checks on Node v24.19.0: node test/docs.js, node test/gates.js, node test/routes.js and node test/migrate.js all exited 0. They validate the measured census (317 source files, 480 test files, 392 tables, 889 routes and 281 explicit npm suites), explicit test discovery, live registered routes and schema reapplication/death-disposition safeguards. git diff --check passed. Runtime/schema/supply-suite diff against reviewed 30b2e4dd is empty after main integration; no native proof is broadened by these release-only checks.

## Source hashes and conclusion

Working-tree SHA256 at release preparation (Git normalizes line endings):

```text
src/supplycontracts.js a71039c90a2a644c93e4b8730db5a2b35fdba1f31f2a7b7f983a052f66f29229
src/depot.js 06fcf66a9b8b74415c58845a1f37de3477060ffe721c00f1e02b0925b9a8cb59
src/depotcontracts.js a533a7b65e18ff82ddca4c32ffc10c078b0443b41f1d8dfcdbfd8935a97b16ee
src/routes/depot.js 91cb3329f9f4e06784516467499a963917bd28b2d47f6938dc5df21fb4e5c4f0
schema.sql c6cba6b1317894383f7d2c5efed643f4ed624d1bc74e263612faaa769c232388
test/supplycontracts.js b917826fc0b3a13aaca1ab6f2924cc0b215881c76239352ef93075b42a37f31f
test/supplycontracts-api.js db9d8b73bb9e803f45db0993fe220317eaa4392a66b0a5e0b7eeb5beaef63e72
```

Ready for review within this bounded game-cash cadence scope, subject to exact-head required checks. No financial rail, procurement scheduler, payout or deployment is activated by this review or PR.

## PR227 required-check failures and repair

At head f195e802627dab1d82f95736004ccc79d661d558, [hosted run 38114178698](https://github.com/OmertaDev/Omerta/actions/runs/38114178698) failed three required jobs. Native PostgreSQL 16/18.4 jobs 114395663547/114395663596 rejected 169 interpolated statements against the unchanged ceiling of 168 and the exact upgrade constraint catalog at phase2-postgres.js:317. The main job 114395663410 failed the full-phone-map marker assertion at city-presence-browser.js:474. These failures are retained separately from the earlier passing feature proof.

SC-R1: latestSupplyContract now uses two literal queries for its locked/unlocked forms, preserving SQL predicates, ordering, limit and parameters. Native preparation can inspect both forms; no scanner ceiling or authority check is relaxed. SC-R2: PostgreSQL 18.4 measured the new table's eight constraints and ten NOT NULL columns; only those additive rows are pinned in phase2-architecture-upgrade-catalog.json. The exact catalog assertion is retained, with new causal negatives rejecting removal of the cadence cycle bound and alteration of its policy foreign key. SC-R3: inspect(npc) could leave the phone roster on a later page; the marker search visited only that page and subsequent pages. Isolated fixture commit 95e7ada655f1764074790680d813b010be249c95 resets the actual roster to its first page before the bounded search. The real marker assertion, tap, exact inspector-opening count, geometry and no-POST checks remain intact. It does not claim a fix for the separate hosted actor-selection timeout.

Repair evidence on Node v24.19.0: focused City presence browser passed; supply helper and memory API passed. Fresh disposable game_supply_repair_20261011 on PostgreSQL 18.4 passed the actual supply API concurrency and injected persistence-error rollback proof. Fresh supply_queries_repair_20261011 passed native pgquery: 4391 static statements prepared, 168 interpolated and 39 nonliteral sites. Fresh supply_phase2_repair_20261011 passed phase2-postgres.js --definitions clean, populated-upgrade, scalar and missing-unique isolated children, preserving exact catalog equality and executing both new causal negatives. The proof's inherited fifteen-control banner was corrected to seventeen after adding the two controls; no assertion changed in that label correction. Per-test schemas were cleaned by the fixture, and the delegated local server was stopped afterward. Local logs: output/supply-repair-native.log, output/supply-repair-pgquery.log, output/supply-repair-phase2.log and output/supply-phone-first-page.log.

The changed runtime helper SHA256 is ba9d8b031475fc42a4834db014b58349a8872f0c649ef065b37d1e563f0ec578. Other supply runtime/schema files remain source-identical to 30b2e4dd. This repair remains subject to coordinator source review, dependency integration, clean-source regeneration and fresh exact-head hosted checks before any release action. Financial activation remains disabled.

## Reviewed dependency stack and fresh combined proof

The coordinator independently reviewed 9cde43ab60978c58769acf68a26b3c43b8a8fa8e with no findings. Exact locked/unlocked query semantics, the eight additive constraints and ten NOT NULL columns, and cycle-bound/policy-binding causal negatives were preserved. Merge 66ce2174014922516d6bc6f7f9a37ede0243442c integrates reviewed delivery source f2e4f45b5b7fbcc1d9308e8018cd720ef59b332e, which includes the earnings API, current main City schema/catalog guards, and the reviewed actor/pose fixtures. PR227 is stacked on codex/authored-delivery-runner. Both City and supply catalog additions are retained; no current City source or guard is removed. Supply runtime and suites are unchanged from reviewed 9cde43ab, and the browser fixture is source-identical to f2e4f45b.

Fresh PostgreSQL 18.4 combined-tree checks exited 0 in dedicated game_supply_stack_20261011, supply_queries_stack_20261011 and supply_phase2_stack_20261011 databases. Actual supply concurrency and injected atomic rollback passed. pgquery prepared 4415 static statements with unchanged counts/ceilings of 168 interpolated and 39 nonliteral sites. Phase 2 definitions passed all four isolated children, full exact populated-upgrade catalog equality and retained causal negatives, including both supply controls. These fresh proofs cover the combined City/supply schema rather than extrapolating from the earlier pre-stack proof. Logs: output/supply-stack-native.log, output/supply-stack-pgquery.log and output/supply-stack-phase2.log. The per-test schemas are cleaned by the fixture; the local server is handed to the coordinator's courier proof owner for its separate database and shutdown.

The combined tree also passed unchanged docs, gates and migration safeguards on Node v24.19.0: 320 source files, 485 test files, 393 tables, 897 routes, 283 explicit npm suites and 721 Markdown files. Migration checks cover 3188 idempotent column additions and all 98 character-scoped death dispositions. git diff --check passed. Knowledge is regenerated from the final clean authored commit and validated before publication. Exact-head hosted checks and coordinator release approval remain required; no merge, deployment, external spending or financial activation is authorized by this proof.
