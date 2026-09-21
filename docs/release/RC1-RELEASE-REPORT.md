# OMERTA RC1 release report

## Assessed revision and release boundary

Exact assessed candidate SHA: **`cce721029c86de7c6f0d875fef7cb8de29504dda`**.
Its application/contract bytes are identical to the full-CI source
`21d0589a8b1f15cbb712e574becd507b813e4b0c`; only the phone harness, evidence upload
paths and generated Knowledge artifacts changed afterward. This source relationship
does not relabel earlier test executions as runs of the later SHA.
Frozen current `origin/main`: `626e61b9ab2b14a9dc45566983b70cdc65692839`.
The original user checkout was preserved. Repairs and proof tools are on
`codex/rc1-closure-proof`; no main merge, production deployment, public admission,
contract transaction or release tag was performed.

During this frozen run, a separate action merged PR183 into main at
`468516d8d6f3729514711ad5a0b83e440c5c46f9`. Its parents are the frozen main and
the previously inspected validation branch 36156ace. That merge changes runtime,
client and deployment files. It is **outside this freeze**; none of this package's
PASS results is a claim about that newer main. See
[observed source movement](evidence/hosted/main-advanced-after-freeze.json).

The immutable [freeze manifest](RC1-RELEASE-MANIFEST.json) records the frozen tree,
848 source-file hashes, package/schema version 1.2.0, migration mechanism,
feature flags, service/worker requirements, declared environment names and historical
contract manifests. Live migration/contract/configuration state is explicitly unverified.
The Git-LF schema hash is
`b126f2832cc793bdca43b5655500cd123bcf884cd5f715aa63bf7af3eb5d6fba`;
the Windows CRLF checkout's runtime schema stamp is different and is retained in native logs.
The [candidate manifest](RC1-CANDIDATE-MANIFEST.json) records each gate-required repair
and Git-byte hashes for all 38 files changed from the freeze to the assessed candidate.

The tested source and the subsequently assembled evidence documents are distinct.
Every scoped run retains its actual source SHA or file hashes. Earlier runs are not relabeled
as executions of the final SHA. Domain/contract code unchanged by later diagnostic/client
repairs is identified in the scoped reports. The complete application regression run
is at 21d0589a; affected harness/generated-artifact checks rerun at cce72102, with
application/contract byte equivalence recorded separately.

## Gate matrix

| Launch gate | Result and evidence |
| --- | --- |
| Critical CI and `npm test` | PASS: pristine frozen-main `npm test`, both full-CI jobs at 21d0589a, and final candidate cce72102's affected Knowledge/docs/guard and hosted recovery/phone checks. Exact source scopes are recorded in the [gate report](RC1-GATE-REPORT.md). |
| Real PostgreSQL suites | PASS: 19 native gates plus six liquidity lanes; full Linux/PostgreSQL16 job passes at 21d0589a. |
| Migrations, retry and rollback | PASS for the recorded source pair: genuine interrupted DDL refuses startup/stamping, retry succeeds; native dump/restore and frozen-predecessor boot preserve all 368 table hashes in the populated fixture. |
| SIGTERM and restart | PASS: all nine real Linux process barriers, native backup/restore, migration fault/retry, command tampering and phone journeys pass together at final candidate cce72102. Windows signal/permission failures are retained and resolved by fresh Linux proof. |
| Economic conservation | PASS within executed scopes; complete resource-by-transition coverage remains missing. No observed unexplained drift is waived. |
| Command replay and duplication | PASS within executed scopes: strict client boundary, concurrent single execution, successful/restarted exact-identity replay; no duplication found. |
| Authorization and Knowledge | PASS within executed scopes: mounted direct API attacks, current ACL/revocation, private projections and native privacy probes. No confirmed remaining P0/P1 exploit in this scoped review. |
| Campaign/operation/World Graph reconstruction | PASS native integration, independent process replay and nine-barrier recovery scopes. |
| 1,000-player simulation | PASS scoped native run: 3,559 commands, 235,895 assertions, 1,225 privacy probes, one completed campaign and three canonical world changes. This is not a sustained concurrent population or long-term equilibrium proof. |
| Full world matrix and dead-world detection | BLOCKED by missing canonical coverage: 75 requested population/archetype cells are unproven. Models and bounded native runs cannot clear this gate. |
| New-player and returning journey | Automated fresh-account PostgreSQL phone journey PASS at two sizes, including first crime, first investigation, visible consequence and reload. Human comprehension/return behavior unobserved. |
| Social, investigation and conflict journey | Five authored branches at two phone widths PASS: 514 rendered commands. A separate continuous social-entry journey adds 60 Player Commands and eight actual membership/recruiting mutations; the ordinary actor joins before contributing and sees the shared result. Prepared eligibility/world fixtures remain explicit. |
| Mobile critical paths | Scoped phone checks PASS, including slow-network lost-response replay and maximum-length input. Complete native keyboard/wallet and large-state stress coverage remains unproven. See [first-session evidence](RC1-FIRST-SESSION.md). |
| Visible major consequences | Executed investigation, crafting and operation branches expose receipts, authorized changed state and updated opportunities. No assertion that unexecuted actions are covered. |
| Production observability | Command correlation/privacy regression PASS. Existing worker, DB, Director and invariant diagnostics inspected; live collection/alert delivery and cohort instrumentation unverified. |
| Foundry | PASS: 1,247 tests across 82 suites; zero failures/skips, full 512×500 invariant budget. |
| Controlled real-player cohort | NOT RUN: zero real participant sessions observed, no selected deployment. Unresolved P0/P1 clearance cannot be inferred. |
| Release operations | Startup and audited recovery documented; live environment/contract configuration and deployment-specific rollback not attested. |

Exact commands, runtime versions, failure classes and raw evidence are in
[RC1-GATE-REPORT.md](RC1-GATE-REPORT.md). A scoped PASS cannot override a missing
required gate. A pending run is never counted as passing.

## Gate-required repairs

| Failed gate | Repair and verification |
| --- | --- |
| Partial migration failure — PG-01 | `src/db.js` now rejects incomplete generic migrations before targeted migrations and schema stamping. Genuine PostgreSQL DDL fault/retry, unit migration and integration retests pass. |
| Command observability — RC1-OBS | Added server-generated correlation IDs and allowlisted, nonthrowing diagnostics through request/auth/command/mutation/consequence/opportunity/response. No account, payload, target, token or Knowledge is logged. Success, replay, failure, revoked and banned cases pass. Request-owned trace context also passes the existing state guard. |
| Critical confirmation — RC1-MOBILE-CONFIRM | Passive screen telemetry no longer invalidates the World projection or cancels its pending confirmation. Exact-route exception only; gameplay mutation refresh is retained. Seven affected regressions pass. |
| PostgreSQL deadlock fixture — PG-02 | Deterministically establishes the intended real refund/holder wait order. Production SQL and exactly-once assertions unchanged; pgcheck passes 203 assertions. |
| Production-compatible simulation tool | Keeps synthetic season overrides confined to pg-mem. Native PostgreSQL scale now boots with the production calendar and checks invariants after each transition. |
| Release proof bookkeeping | Registered new proof gates, updated exact test inventory/measured SPEC counts, regenerated Knowledge artifacts from a clean commit, and corrected browser navigation/scrolling in test harnesses. Existing CI lanes, timeouts and correctness assertions remain. |

No new major gameplay, economy, social hierarchy, progression, graph, crafting,
mystery, currency or blockchain mechanic was added.

## Simulation results and conservation boundary

All five native entry populations pass: 25, 100, 250, 500 and 1,000 players.
They total 1,875 API-created players, 15,000 requests, 3,750 commands,
3,750 exact retries and 516,175 invariant assertions. Only the recorded discovery
commands are credited to that policy.

Six native social/inventory/campaign runs across the same populations pass with
6,866 commands, 293 durable replays, 454,355 invariant assertions and 2,300 privacy
probes with zero disclosures. Declared starting cash is reconciled explicitly;
five prepared actors conduct the authored conflict. These are not 1,000 simultaneous
operation participants. No sampled native visit lacked an available command, and
no native dead world or duplicated consequence was demonstrated.

The deterministic Director model covers 130 runs and 520 snapshots through 180 modeled
days. Its smallest unfunded observation is 25 modeled players, seed `rc1-director-a`,
`economic_shortage`, day 1, with three unfunded scopes. This is a model observation,
not proof of an irreversible whole-game deadlock. Native UUIDs, SQL time and some
resolution seeds are not all fixed, so native runs do not claim bit-identical replay.

See [simulation report](RC1-SIMULATION-REPORT.md),
[run totals](evidence/simulation/run-summary.json),
[coverage](evidence/simulation/matrix-coverage.json) and
[exact remaining proof gaps](evidence/simulation/blockers.json).

## Security, mobile and golden journeys

The [security report](RC1-SECURITY-REPORT.md) records 18 targeted regression suites,
42 real PostgreSQL common-command tampering denials, concurrent single execution
and full-server restart replay. A focused seven-detector Slither run found no result
in its VoucherClaim scope. These are bounded findings, not certification of every
route or an unseen deployed contract. Dependency/compiler provisioning failures and
test-harness defects remain visible with their classifications.

The [first-session report](RC1-FIRST-SESSION.md) records a new player reaching an
actual first action, opening an available investigation and seeing a consequence on
390×844 and 360×800 viewports without injected wealth, leadership or inventory.
Latest scripted first-action timings of 4.928s and 4.126s are not human comprehension estimates.
The existing mobile harness passed 175 screen checks across three phone sizes,
including its stored-XSS sweep. The [golden-journey report](RC1-JOURNEYS-REPORT.md)
records all ten campaign/viewport cells and their social fixture limitations. A further
social-entry run proves the ordinary actor's request, leader approval, Family membership,
contributions and shared consequence through actual mobile controls. The slow-network
test proves a lost committed response can be retried from the visible saved-move control
without duplicating the nine-table canonical census.

## Controlled cohort and production state

No real-player cohort was deployed or observed. Session completion, abandonment,
return rate, confusing dead ends, mobile failure and repeated human misunderstandings
are **unmeasured**, not zero. Bot requests, fixture accounts and reloads are excluded
from participant and retention counts.

The requested cohort target/tester information is absent. The Render connector
returned no selected workspace and explicitly requires user selection before access;
its discovered workspace was presented for confirmation. No selection response or
live service/configuration evidence was received. No production secret values were copied to
the evidence package. The freeze manifest's production migration/contract fields
remain `UNVERIFIED`.
The machine-readable record is [cohort-status.json](evidence/cohort-status.json);
unobserved metrics and defect counts are null rather than zero.

## Remaining release blockers and reproduction

Only actual unmet gates are listed here; repaired defects above are not open blockers.

1. **RC1-SIM-MATRIX-01 — full canonical equilibrium proof is absent.** Read
   `evidence/simulation/matrix-coverage.json`: `requiredCells=75`,
   `canonicalEquilibriumCellsProven=0`. Reproduce the narrower passing run with
   `node tools/rc1-sim.js --postgres --populations=1000 --seeds=rc1-alpha --replicates=1 --rounds=2 --output=tmp/rc1-native`.
   Its declared `notMeasured` excludes sustained population contention, long-term
   starvation and independent Family dynamics. Running the model does not satisfy
   this gate. The missing workload must establish the requested long-term archetypes,
   dead-world conditions and growth/concentration metrics against canonical PostgreSQL.
2. **RC1-SIM-CONSERVATION-02 — complete resource/transition proof is absent.** Read
   `evidence/simulation/blockers.json` and the conservation scope table. Assertions
   run after native commands/ticks, but their journals do not cover every compound
   fixture step or existing resource transition. The nine specific gaps include nonzero
   OMR, capital settlement, hardening cash, custody/escrow dispositions, Family treasury,
   legacy campaign cash claims, daily shipment materials and NFT/chain movements.
   [Resource coverage](evidence/simulation/resource-transition-coverage.json) distinguishes
   missing simulation journals from component tests and intentionally nonmonetary world
   outcomes. Reproduce the recorded sweeps with the simulation report's commands; zero
   observed drift does not prove unexecuted transitions. No discrepancy was waived.
3. **RC1-PLAYER-PROOF — complete release interaction evidence is absent.** The
   first-session and journey reports distinguish prepared actors and scripted clicks
   from an unfamiliar player understanding the objective and voluntarily returning.
   Reproduce `node test/rc1-mobile-postgres.js` and `node tools/rc1-campaign-mobile.js`
   against the documented isolated databases; inspect their setup and coverage before
   claiming full account/wallet, keyboard, large-inventory/Family/feed stress or human
   first-15-minute clearance. No unobserved usability problem is asserted as a defect.
4. **RC1-PRODUCTION-COHORT — deployed configuration and real cohort clearance are absent.**
   Inspect the manifest's `productionAppliedState`, the cohort section above and hosted
   artifacts: they contain isolated tests, not an approved production configuration or
   real-player sessions. The connector's `list_services` operation returned
   `no workspace selected`; no deployment was attempted. A selected controlled environment,
   verified runtime/worker/flags/contracts, actual cohort measurements and disposition of
   all repeated P0/P1 failures are required before public traffic.
   Main also advanced to 468516d8 during the freeze. Its runtime/configuration changes
   must be reconciled with the explicitly selected deployment revision; neither a merge
   nor its historical branch evidence transfers this candidate's proof to that source.

All executed automated gates have terminal results. The missing required proofs above
remain release blockers despite the passing scoped tests.

## Known nonblocking defects

No additional confirmed open nonblocking defect was established by this pass.
The long mobile Command Center is a recorded observation for real cohort evaluation,
not a claimed failure or a justification for redesign. Resolved tooling/environment
failures remain in the gate report so that green retests do not erase their history.

## Deployment and rollback

Follow [RC1-RECOVERY-RUNBOOK.md](RC1-RECOVERY-RUNBOOK.md): install the lockfile, select
the exact tested SHA and isolated database, configure the existing cohort flags and
secrets consistently, verify a native restore, boot the API and one matching worker,
check health/heartbeat and persisted receipts, then admit only the approved cohort.
The runbook covers stuck campaigns/operations, bad opportunities, worker crashes,
failed migrations, generated-content/mystery failures, bad world mutations and rollback.
Every intervention requires restricted audit records and before/after conservation.

For rollback, close affected admission, retain a native backup, drain API/worker and
restore the specifically tested predecessor on both services. A code rollback does not
reverse committed world effects; a live database replacement can discard valid actions
and requires a separately reviewed recovery decision. The tested rehearsal preserved
368 table hashes, with 71 populated tables, then booted the exact frozen predecessor.
It is not blanket compatibility with every historical or live database.

## Evidence preservation

The package retains failed attempts and successful retests. Its SHA256 inventory is
`RC1-EVIDENCE-INDEX.json`; run `node docs/release/verify-evidence.mjs` from any checkout
to check the retained file bytes. The index excludes itself to avoid a circular hash.
Release files are marked `-text` in Git attributes so checkout line-ending conversion
cannot alter the captured bytes. Independent scoped inventories also verify the 19
reviewed security source files, 50 security evidence files and 53 simulation/report files.

## Final state

**NOT RELEASE READY**
